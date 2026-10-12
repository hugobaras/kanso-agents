import type { Pool } from "pg";
import type { Product } from "@kanso/shared";

export type UsageRecordInput = {
  tenantId: string;
  product: Product;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedEur: number;
  correlationId: string;
};

export async function recordUsage(
  pool: Pool,
  input: UsageRecordInput,
): Promise<void> {
  await pool.query(
    `insert into usage_ledger
       (tenant_id, product, provider, model_id, input_tokens, output_tokens, estimated_eur, correlation_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.tenantId,
      input.product,
      input.provider,
      input.modelId,
      input.inputTokens,
      input.outputTokens,
      input.estimatedEur,
      input.correlationId,
    ],
  );
}

export async function sumUsageEurToday(
  pool: Pool,
  tenantId: string,
): Promise<number> {
  const res = await pool.query<{ total: string }>(
    `select coalesce(sum(estimated_eur), 0)::text as total
     from usage_ledger
     where tenant_id = $1
       and at >= date_trunc('day', now() at time zone 'Europe/Paris')
         at time zone 'Europe/Paris'`,
    [tenantId],
  );
  return Number(res.rows[0]?.total ?? 0);
}

/** Portal / ops: day totals in Europe/Paris calendar day. */
export async function usageStatsToday(
  pool: Pool,
  tenantId: string,
): Promise<{
  dayTotalEur: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const res = await pool.query<{
    total: string;
    calls: string;
    input_tokens: string;
    output_tokens: string;
  }>(
    `select
       coalesce(sum(estimated_eur), 0)::text as total,
       coalesce(count(*), 0)::text as calls,
       coalesce(sum(input_tokens), 0)::text as input_tokens,
       coalesce(sum(output_tokens), 0)::text as output_tokens
     from usage_ledger
     where tenant_id = $1
       and at >= date_trunc('day', now() at time zone 'Europe/Paris')
         at time zone 'Europe/Paris'`,
    [tenantId],
  );
  const row = res.rows[0];
  return {
    dayTotalEur: Number(row?.total ?? 0),
    callCount: Number(row?.calls ?? 0),
    inputTokens: Number(row?.input_tokens ?? 0),
    outputTokens: Number(row?.output_tokens ?? 0),
  };
}

export async function softCapAlreadyAlertedToday(
  pool: Pool,
  tenantId: string,
): Promise<boolean> {
  const res = await pool.query(
    `select 1 from audit_events
     where tenant_id = $1
       and step = 'soft_cap'
       and decision = 'exceeded'
       and at >= date_trunc('day', now() at time zone 'Europe/Paris')
         at time zone 'Europe/Paris'
     limit 1`,
    [tenantId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function recordSoftCapBreach(
  pool: Pool,
  opts: {
    tenantId: string;
    correlationId: string;
    dayTotalEur: number;
    softCapEur: number;
  },
): Promise<void> {
  await pool.query(
    `insert into audit_events
       (tenant_id, at, step, decision, summary, actor, correlation_id)
     values ($1, now(), 'soft_cap', 'exceeded', $2::jsonb, 'system', $3)`,
    [
      opts.tenantId,
      JSON.stringify({
        day_total_eur: opts.dayTotalEur,
        soft_cap_eur: opts.softCapEur,
      }),
      opts.correlationId,
    ],
  );
}

/** Soft cap journalier €/tenant — défaut hypothèse pilote (H-027). */
export function softCapEurPerDay(): number {
  const raw = process.env.KANSO_SOFT_CAP_EUR_PER_DAY;
  if (raw === undefined || raw === "") return 5;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}
