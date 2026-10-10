import type { AdapterResult } from "@kanso/shared";

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export async function withAdapterRetry<T>(
  fn: (attempt: number) => Promise<AdapterResult<T>>,
  opts: RetryOptions = {},
): Promise<AdapterResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const sleep =
    opts.sleep ??
    ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let last: AdapterResult<T> | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await fn(attempt);
    if (last.status === "ok" || last.status === "fatal") return last;
    if (attempt < maxAttempts) {
      const delay =
        last.retryAfterMs ??
        Math.round(baseDelayMs * 2 ** (attempt - 1) * (0.9 + Math.random() * 0.2));
      await sleep(delay);
    }
  }
  return last ?? {
    status: "fatal",
    errorCode: "retry_exhausted",
    message: "No attempts executed",
  };
}
