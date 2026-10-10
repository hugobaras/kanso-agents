import {
  estimateUsageEur,
  type LlmUsage,
  type MeteringLlmClient,
} from "@kanso/llm";
import {
  getPool,
  recordSoftCapBreach,
  recordUsage,
  softCapAlreadyAlertedToday,
  softCapEurPerDay,
  sumUsageEurToday,
} from "@kanso/tenancy";

export async function flushMeteredUsage(opts: {
  tenantId: string;
  correlationId: string;
  metering: MeteringLlmClient;
}): Promise<{ recorded: number; dayTotalEur: number; softCapBreached: boolean }> {
  const pool = getPool();
  for (const usage of opts.metering.usages) {
    await persistOne(pool, opts.tenantId, opts.correlationId, usage);
  }

  const dayTotalEur = await sumUsageEurToday(pool, opts.tenantId);
  const cap = softCapEurPerDay();
  let softCapBreached = false;

  if (dayTotalEur > cap && !(await softCapAlreadyAlertedToday(pool, opts.tenantId))) {
    softCapBreached = true;
    await recordSoftCapBreach(pool, {
      tenantId: opts.tenantId,
      correlationId: opts.correlationId,
      dayTotalEur,
      softCapEur: cap,
    });
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "soft_cap_exceeded",
        tenant_id: opts.tenantId,
        day_total_eur: dayTotalEur,
        soft_cap_eur: cap,
        correlation_id: opts.correlationId,
      }),
    );
  }

  return {
    recorded: opts.metering.usages.length,
    dayTotalEur,
    softCapBreached,
  };
}

async function persistOne(
  pool: ReturnType<typeof getPool>,
  tenantId: string,
  correlationId: string,
  usage: LlmUsage,
): Promise<void> {
  await recordUsage(pool, {
    tenantId,
    product: "inbound",
    provider: usage.provider,
    modelId: usage.modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedEur: estimateUsageEur(usage),
    correlationId,
  });
}
