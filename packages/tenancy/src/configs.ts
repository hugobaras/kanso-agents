import type { Pool, PoolClient } from "pg";
import type { Product } from "@kanso/shared";

/**
 * Versioned tenant configs. `tenant_configs` keeps every published version
 * (older ones flipped back to status 'draft' = archived, as before);
 * `config_drafts` holds the single editable working copy per product.
 * Callers validate with the product's Zod schema before publishing.
 */

export type PublishedConfig = {
  config: unknown;
  version: number;
  published_at: Date | null;
  published_by: string | null;
};

export async function loadPublishedConfig(
  pool: Pool | PoolClient,
  tenantId: string,
  product: Product,
): Promise<PublishedConfig | null> {
  const res = await pool.query<PublishedConfig>(
    `select config, version, published_at, published_by from tenant_configs
     where tenant_id = $1 and product = $2 and status = 'published'
     order by version desc limit 1`,
    [tenantId, product],
  );
  return res.rows[0] ?? null;
}

export async function publishConfig(
  pool: Pool,
  opts: {
    tenantId: string;
    product: Product;
    config: { schema_version: string };
    publishedBy: string;
  },
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Serialize concurrent publishes for the same tenant/product.
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `${opts.tenantId}:${opts.product}`,
    ]);
    const versionRes = await client.query<{ version: number }>(
      `select coalesce(max(version), 0) + 1 as version
       from tenant_configs where tenant_id = $1 and product = $2`,
      [opts.tenantId, opts.product],
    );
    const version = versionRes.rows[0]?.version ?? 1;
    await client.query(
      `update tenant_configs set status = 'draft'
       where tenant_id = $1 and product = $2 and status = 'published'`,
      [opts.tenantId, opts.product],
    );
    await client.query(
      `insert into tenant_configs
        (tenant_id, product, version, schema_version, config, status, published_at, published_by)
       values ($1, $2, $3, $4, $5::jsonb, 'published', now(), $6)`,
      [
        opts.tenantId,
        opts.product,
        version,
        opts.config.schema_version,
        JSON.stringify(opts.config),
        opts.publishedBy,
      ],
    );
    await client.query("commit");
    return version;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function loadDraftConfig(
  pool: Pool,
  tenantId: string,
  product: Product,
): Promise<{ config: unknown; updated_at: Date } | null> {
  const res = await pool.query<{ config: unknown; updated_at: Date }>(
    `select config, updated_at from config_drafts where tenant_id = $1 and product = $2`,
    [tenantId, product],
  );
  return res.rows[0] ?? null;
}

export async function saveDraftConfig(
  pool: Pool,
  opts: { tenantId: string; product: Product; config: unknown; updatedBy: string },
): Promise<void> {
  await pool.query(
    `insert into config_drafts (tenant_id, product, config, updated_by, updated_at)
     values ($1, $2, $3::jsonb, $4, now())
     on conflict (tenant_id, product)
     do update set config = excluded.config, updated_by = excluded.updated_by, updated_at = now()`,
    [opts.tenantId, opts.product, JSON.stringify(opts.config), opts.updatedBy],
  );
}

export async function listConfigVersions(
  pool: Pool,
  tenantId: string,
  product: Product,
  limit = 20,
): Promise<Array<{ version: number; status: string; published_at: Date | null; published_by: string | null }>> {
  const res = await pool.query(
    `select version, status, published_at, published_by from tenant_configs
     where tenant_id = $1 and product = $2 order by version desc limit $3`,
    [tenantId, product, limit],
  );
  return res.rows;
}
