import { getPool } from "@kanso/tenancy";

export function workerHeartbeat(meta: Record<string, unknown> = {}) {
  return {
    ok: true,
    service: "document-worker",
    at: new Date().toISOString(),
    ...meta,
  };
}

/** Persist heartbeat for API /health (best-effort). */
export async function persistWorkerHeartbeat(
  meta: Record<string, unknown> = {},
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const pool = getPool();
    await pool.query(
      `insert into service_heartbeats (service, at, meta)
       values ('document-worker', now(), $1::jsonb)
       on conflict (service)
       do update set at = now(), meta = excluded.meta`,
      [JSON.stringify(meta)],
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "warn",
        msg: "document-worker heartbeat persist failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
