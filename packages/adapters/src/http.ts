import type { AdapterResult } from "@kanso/shared";

export function classifyHttpStatus(
  status: number,
  message: string,
): AdapterResult<never> {
  if (status === 408 || status === 429 || (status >= 500 && status <= 504)) {
    return {
      status: "retryable",
      errorCode: `http_${status}`,
      message: message.slice(0, 300),
      retryAfterMs: status === 429 ? 2000 : undefined,
    };
  }
  return {
    status: "fatal",
    errorCode: `http_${status}`,
    message: message.slice(0, 300),
  };
}

export function networkError(err: unknown): AdapterResult<never> {
  const message = err instanceof Error ? err.message : String(err);
  const retryable = /timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(
    message,
  );
  return {
    status: retryable ? "retryable" : "fatal",
    errorCode: retryable ? "network_transient" : "network_fatal",
    message: message.slice(0, 300),
  };
}
