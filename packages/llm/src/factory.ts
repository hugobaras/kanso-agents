import { KansoError } from "@kanso/shared";
import { MistralLlmClient } from "./mistral.js";
import { MockLlmClient } from "./mock.js";
import type { LlmClient } from "./types.js";

export type CreateLlmClientOptions = {
  /** Fixtures for MockLlmClient when no live key. */
  fixtures?: unknown[];
  /** Force mock even if MISTRAL_API_KEY is set (tests). */
  forceMock?: boolean;
};

/**
 * Provider selection:
 * - MISTRAL_API_KEY → Mistral EU endpoint (default)
 * - else → MockLlmClient (CI / local without key)
 *
 * KANSO_E2E_LIVE=1 without key → error (no silent stub).
 */
export function createLlmClient(opts: CreateLlmClientOptions = {}): LlmClient {
  if (opts.forceMock) {
    return new MockLlmClient(opts.fixtures ?? []);
  }

  const key = process.env.MISTRAL_API_KEY;
  if (key) {
    return new MistralLlmClient({
      apiKey: key,
      ...(process.env.MISTRAL_BASE_URL
        ? { baseUrl: process.env.MISTRAL_BASE_URL }
        : {}),
      ...(process.env.KANSO_MISTRAL_MODEL
        ? { model: process.env.KANSO_MISTRAL_MODEL }
        : {}),
    });
  }

  if (process.env.KANSO_E2E_LIVE === "1") {
    throw new KansoError(
      "KANSO_E2E_LIVE=1 requires MISTRAL_API_KEY",
      "llm_live_missing_key",
    );
  }

  return new MockLlmClient(opts.fixtures ?? []);
}
