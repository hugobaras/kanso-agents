import { KansoError } from "@kanso/shared";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

/** Throw from any handler; rendered as `{ error, message?, details? }`. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const notFound = (code = "not_found") => new HttpError(404, code);
export const forbidden = (code = "forbidden", message?: string) =>
  new HttpError(403, code, message);
export const badRequest = (code: string, message?: string, details?: unknown) =>
  new HttpError(400, code, message, details);

const KANSO_STATUS: Record<string, ContentfulStatusCode> = {
  invalid_tenant: 400,
  session_not_found: 404,
  secret_not_found: 404,
};

export function handleError(err: Error, c: Context): Response {
  if (err instanceof HttpError) {
    return c.json(
      {
        error: err.code,
        ...(err.message !== err.code ? { message: err.message } : {}),
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
      err.status,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "validation_failed",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      400,
    );
  }
  if (err instanceof KansoError && KANSO_STATUS[err.code]) {
    return c.json({ error: err.code }, KANSO_STATUS[err.code]!);
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_error",
      request_id: c.get("requestId" as never),
      path: c.req.path,
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 6).join(" | "),
    }),
  );
  return c.json({ error: "internal_error" }, 500);
}
