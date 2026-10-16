import type { z } from "zod";

/** Parse a JSON body with a Zod schema (ZodError → 400 via handleError). */
export async function body<T extends z.ZodTypeAny>(
  req: { json: () => Promise<unknown> },
  schema: T,
): Promise<z.infer<T>> {
  return schema.parse(await req.json().catch(() => ({})));
}
