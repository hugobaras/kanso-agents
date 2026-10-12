import { getPool } from "@kanso/tenancy";
import { Hono } from "hono";
import type { AppEnv } from "../http/types.js";

/** Dev-only outbox viewer for console-transport e-mails (never mounted in production). */
export function devRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/mails", async (c) => {
    const to = c.req.query("to");
    const res = await getPool().query(
      `select id, to_email, subject, template, text_body, created_at from mail_outbox
       where ($1::text is null or to_email = lower($1)) order by created_at desc limit 50`,
      [to ?? null],
    );
    return c.json({ mails: res.rows });
  });

  app.get("/mails/:id", async (c) => {
    const res = await getPool().query<{ html: string }>(`select html from mail_outbox where id = $1::uuid`, [c.req.param("id")]);
    if (!res.rows[0]) return c.text("not found", 404);
    return c.html(res.rows[0].html);
  });

  return app;
}
