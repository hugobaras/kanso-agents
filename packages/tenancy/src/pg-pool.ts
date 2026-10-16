import pg from "pg";
import { KansoError } from "@kanso/shared";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(databaseUrl = process.env.DATABASE_URL): pg.Pool {
  if (!databaseUrl) {
    throw new KansoError("DATABASE_URL missing", "missing_database_url");
  }
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

/** Run `fn` in a transaction on a dedicated client (commit / rollback handled). */
export async function withTransaction<T>(
  p: pg.Pool,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await p.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function withTenantLocal<T>(
  databaseUrl: string,
  tenantId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const p = getPool(databaseUrl);
  const client = await p.connect();
  try {
    await client.query("select set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    return await fn(client);
  } finally {
    client.release();
  }
}
