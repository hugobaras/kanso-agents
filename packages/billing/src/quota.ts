import type { Pool } from "pg";
import type { Metric } from "./plans.js";

/** Calendar month in Europe/Paris, e.g. "2026-10". */
export function currentPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

export type QuotaResult =
  | { ok: true; used: number; limit: number }
  | { ok: false; used: number; limit: number };

/**
 * Atomically consume one unit if under the limit. Concurrent callers can never
 * push the counter past `limit` (the conditional upsert is a single statement).
 */
export async function consumeQuota(
  pool: Pool,
  tenantId: string,
  metric: Metric,
  limit: number,
  now = new Date(),
): Promise<QuotaResult> {
  const period = currentPeriod(now);
  if (limit <= 0) {
    return { ok: false, used: await readUsage(pool, tenantId, metric, period), limit };
  }
  const res = await pool.query<{ count: number }>(
    `insert into usage_counters (tenant_id, metric, period, count)
     values ($1, $2, $3, 1)
     on conflict (tenant_id, metric, period)
     do update set count = usage_counters.count + 1
     where usage_counters.count < $4
     returning count`,
    [tenantId, metric, period, limit],
  );
  const row = res.rows[0];
  if (row) return { ok: true, used: row.count, limit };
  return { ok: false, used: await readUsage(pool, tenantId, metric, period), limit };
}

export async function readUsage(
  pool: Pool,
  tenantId: string,
  metric: Metric,
  period = currentPeriod(),
): Promise<number> {
  const res = await pool.query<{ count: number }>(
    `select count from usage_counters where tenant_id = $1 and metric = $2 and period = $3`,
    [tenantId, metric, period],
  );
  return res.rows[0]?.count ?? 0;
}

export async function readAllUsage(
  pool: Pool,
  tenantId: string,
  period = currentPeriod(),
): Promise<Record<Metric, number>> {
  const res = await pool.query<{ metric: Metric; count: number }>(
    `select metric, count from usage_counters where tenant_id = $1 and period = $2`,
    [tenantId, period],
  );
  const out: Record<Metric, number> = { conversations: 0, documents: 0 };
  for (const r of res.rows) out[r.metric] = r.count;
  return out;
}
