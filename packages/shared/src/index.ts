export type Product = "inbound" | "document_to_action";

export type AdapterStatus = "ok" | "retryable" | "fatal";

export type AdapterResult<T> =
  | { status: "ok"; data: T; providerRequestId?: string }
  | { status: "retryable"; errorCode: string; message: string; retryAfterMs?: number }
  | { status: "fatal"; errorCode: string; message: string };

export type AdapterContext = {
  tenantId: string;
  correlationId: string;
  configVersion: number;
  attempt: number;
};

export class KansoError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "KansoError";
  }
}

export function assertNever(value: never): never {
  throw new KansoError(`Unexpected value: ${String(value)}`, "assert_never");
}
