import { getPool } from "@kanso/tenancy";

const STALE_MS = Number(process.env.KANSO_WORKER_STALE_MS ?? 120_000);

export type HealthBody = {
  ok: boolean;
  service: string;
  env: string;
  db: { ok: boolean; error?: string };
  worker: {
    ok: boolean;
    at: string | null;
    age_ms: number | null;
    stale: boolean;
    meta?: Record<string, unknown>;
  };
};

export async function buildHealth(): Promise<HealthBody> {
  const env = process.env.KANSO_ENV ?? "local";
  let dbOk = false;
  let dbError: string | undefined;
  let workerAt: string | null = null;
  let workerMeta: Record<string, unknown> | undefined;
  let ageMs: number | null = null;

  if (!process.env.DATABASE_URL) {
    dbError = "DATABASE_URL missing";
  } else {
    try {
      const pool = getPool();
      await pool.query("select 1");
      dbOk = true;
      try {
        const res = await pool.query<{
          at: Date;
          meta: Record<string, unknown>;
        }>(
          `select at, meta from service_heartbeats where service = 'document-worker'`,
        );
        const row = res.rows[0];
        if (row) {
          workerAt = new Date(row.at).toISOString();
          workerMeta = row.meta ?? {};
          ageMs = Date.now() - new Date(row.at).getTime();
        }
      } catch {
        // table missing on old DB — report unknown worker
      }
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  const stale = ageMs === null || ageMs > STALE_MS;
  const workerOk = ageMs !== null && !stale;
  // Process liveness: always ok if handler runs; db/worker are probes.
  const ok = true;

  return {
    ok,
    service: "inbound-api",
    env,
    db: { ok: dbOk, ...(dbError ? { error: dbError } : {}) },
    worker: {
      ok: workerOk,
      at: workerAt,
      age_ms: ageMs,
      stale,
      ...(workerMeta ? { meta: workerMeta } : {}),
    },
  };
}
