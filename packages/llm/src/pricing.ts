import type { LlmUsage } from "./types.js";

/**
 * Tarifs indicatifs € / 1M tokens (hypothèse pilote H-027/H-031).
 * À recalibrer quand les associés figent les soft caps.
 */
const RATES_EUR_PER_MTOK: Record<
  string,
  { input: number; output: number }
> = {
  "mistral:mistral-small-latest": { input: 0.1, output: 0.3 },
  "mistral:mistral-small": { input: 0.1, output: 0.3 },
  "mock:mock-deterministic": { input: 0, output: 0 },
};

const DEFAULT_RATE = { input: 0.2, output: 0.6 };

export function estimateUsageEur(usage: LlmUsage): number {
  const key = `${usage.provider}:${usage.modelId}`;
  const rate = RATES_EUR_PER_MTOK[key] ?? DEFAULT_RATE;
  const eur =
    (usage.inputTokens / 1_000_000) * rate.input +
    (usage.outputTokens / 1_000_000) * rate.output;
  return Math.round(eur * 1_000_000) / 1_000_000;
}
