import type { LlmClient, LlmStructuredRequest, LlmUsage } from "./types.js";

export type RetryLlmClientOptions = {
  /** Max attempts including the first. Default 3. */
  maxAttempts?: number;
  /** Base delay ms for exponential backoff. Default 400. */
  baseDelayMs?: number;
  /** Retry only when predicate true. Default: rate-limit / 429 / 5xx-ish. */
  shouldRetry?: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
};

function defaultShouldRetry(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate.?limit|503|502|504|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
    msg,
  );
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries transient LLM failures (esp. Mistral 429) before surfacing the error.
 * Pair with FallbackLlmClient so heuristic runs only after retries are exhausted.
 */
export class RetryLlmClient implements LlmClient {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly shouldRetry: (err: unknown) => boolean;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly inner: LlmClient,
    opts: RetryLlmClientOptions = {},
  ) {
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 400;
    this.shouldRetry = opts.shouldRetry ?? defaultShouldRetry;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  async completeStructured<T>(
    req: LlmStructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.inner.completeStructured(req);
      } catch (err) {
        lastError = err;
        if (attempt >= this.maxAttempts || !this.shouldRetry(err)) {
          throw err;
        }
        const delay = this.baseDelayMs * 2 ** (attempt - 1);
        await this.sleep(delay);
      }
    }
    throw lastError;
  }
}
