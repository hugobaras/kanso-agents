#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseInboundConfig, parseDocumentToActionConfig } from "@kanso/config";
import {
  getPool,
  PostgresSecretStore,
  requireTenantId,
  runRetentionPurge,
} from "@kanso/tenancy";

function usage() {
  console.log(`Usage:
  kanso-admin validate-config <tenant_id> <path-to-config.json>
  kanso-admin create-tenant <tenant_id> <display_name>
  kanso-admin put-secret <tenant_id> <secret_ref> <json-credentials>
  kanso-admin publish-config <tenant_id> <path-to-config.json>
  kanso-admin purge-retention [--dry-run|--execute]
  kanso-admin confirm-final-action <tenant_id> --i-understand-final
`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    usage();
    process.exit(0);
  }

  if (cmd === "validate-config") {
    const [tenantId, filePath] = args;
    if (!tenantId || !filePath) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
      product?: string;
    };
    if (raw.product === "inbound") parseInboundConfig(raw);
    else if (raw.product === "document_to_action")
      parseDocumentToActionConfig(raw);
    else throw new Error("Unknown product");
    console.log(JSON.stringify({ ok: true, tenantId, product: raw.product }));
    return;
  }

  if (cmd === "create-tenant") {
    const [tenantId, displayName] = args;
    if (!tenantId || !displayName) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const pool = getPool();
    await pool.query(
      `insert into tenants (tenant_id, display_name, status)
       values ($1, $2, 'draft')
       on conflict (tenant_id) do update set display_name = excluded.display_name`,
      [tenantId, displayName],
    );
    console.log(JSON.stringify({ ok: true, tenantId, status: "draft" }));
    await pool.end();
    return;
  }

  if (cmd === "put-secret") {
    const [tenantId, secretRef, jsonCreds] = args;
    if (!tenantId || !secretRef || !jsonCreds) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const masterKey = process.env.KANSO_MASTER_KEY;
    if (!masterKey) throw new Error("KANSO_MASTER_KEY required");
    const credentials = JSON.parse(jsonCreds) as Record<string, string>;
    const pool = getPool();
    const store = new PostgresSecretStore(pool, masterKey);
    await store.put(tenantId, secretRef, credentials);
    console.log(JSON.stringify({ ok: true, tenantId, secretRef }));
    await pool.end();
    return;
  }

  if (cmd === "publish-config") {
    const [tenantId, filePath] = args;
    if (!tenantId || !filePath) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
      product?: string;
      schema_version?: string;
    };
    if (raw.product === "inbound") parseInboundConfig(raw);
    else if (raw.product === "document_to_action")
      parseDocumentToActionConfig(raw);
    else throw new Error("Unknown product");

    const pool = getPool();
    const versionRes = await pool.query<{ version: number }>(
      `select coalesce(max(version), 0) + 1 as version
       from tenant_configs where tenant_id = $1 and product = $2`,
      [tenantId, raw.product],
    );
    const version = versionRes.rows[0]?.version ?? 1;
    await pool.query(
      `update tenant_configs set status = 'draft'
       where tenant_id = $1 and product = $2 and status = 'published'`,
      [tenantId, raw.product],
    );
    await pool.query(
      `insert into tenant_configs
        (tenant_id, product, version, schema_version, config, status, published_at, published_by)
       values ($1, $2, $3, $4, $5::jsonb, 'published', now(), 'admin-cli')`,
      [
        tenantId,
        raw.product,
        version,
        raw.schema_version ?? "1.0.0",
        JSON.stringify(raw),
      ],
    );
    console.log(
      JSON.stringify({ ok: true, tenantId, product: raw.product, version }),
    );
    await pool.end();
    return;
  }

  if (cmd === "purge-retention") {
    const mode = args[0] ?? "--dry-run";
    if (mode !== "--dry-run" && mode !== "--execute") {
      usage();
      process.exit(1);
    }
    const pool = getPool();
    const result = await runRetentionPurge(pool, {
      dryRun: mode !== "--execute",
    });
    console.log(JSON.stringify({ ok: true, ...result }));
    await pool.end();
    return;
  }

  if (cmd === "confirm-final-action") {
    const [tenantId, flag] = args;
    if (!tenantId || flag !== "--i-understand-final") {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const pool = getPool();
    await pool.query(
      `insert into audit_events
         (tenant_id, at, step, decision, summary, actor, correlation_id)
       values ($1, now(), 'final_mode', 'confirmed', $2::jsonb, 'admin-cli', $3)`,
      [
        tenantId,
        JSON.stringify({
          warning:
            "Écriture comptable finale autorisée — obligation de moyens, pas de garantie métier",
        }),
        `final-${tenantId}-${Date.now()}`,
      ],
    );
    console.log(
      JSON.stringify({
        ok: true,
        tenantId,
        message:
          "Confirmation enregistrée. Exporter KANSO_ALLOW_FINAL=1 sur le worker pour activer action.mode=final.",
        env: "KANSO_ALLOW_FINAL=1",
      }),
    );
    await pool.end();
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
