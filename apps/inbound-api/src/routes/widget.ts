import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEntitlements } from "@kanso/billing";
import {
  blocksAfterHours,
  isWithinBusinessHours,
  PostgresSessionStore,
  resolveAfterHoursMessage,
  resolveExpectedQuestion,
} from "@kanso/inbound-engine";
import { getPool } from "@kanso/tenancy";
import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { isLocalOrigin, originMatches } from "../cors-origins.js";
import { appUrl, isProd } from "../env.js";
import { HttpError, notFound } from "../http/errors.js";
import { clientIp, rateLimit, type RateLimiter } from "../http/rate-limit.js";
import type { AppEnv, WidgetContext } from "../http/types.js";
import {
  loadInboundConfig,
  runInboundTurn,
  startInboundSession,
  UNAVAILABLE_MESSAGE,
  type InboundDeps,
} from "../services/inbound.js";

const here = dirname(fileURLToPath(import.meta.url));
const widgetJsCandidates = [
  join(here, "../../../inbound-widget/dist/kanso-widget.js"),
  join(process.cwd(), "apps/inbound-widget/dist/kanso-widget.js"),
  join(process.cwd(), "../inbound-widget/dist/kanso-widget.js"),
];

let widgetCache: { path: string; mtime: number; body: Buffer; etag: string } | null = null;

function loadWidgetBundle(): { body: Buffer; etag: string } | null {
  const path = widgetJsCandidates.find((p) => existsSync(p));
  if (!path) return null;
  const mtime = statSync(path).mtimeMs;
  if (!widgetCache || widgetCache.path !== path || widgetCache.mtime !== mtime) {
    const body = readFileSync(path);
    widgetCache = { path, mtime, body, etag: `"w-${Math.round(mtime).toString(36)}-${body.length}"` };
  }
  return widgetCache;
}

const SESSION_ID = z.string().uuid();

type KeyRow = {
  id: string;
  tenant_id: string;
  mode: "live" | "test";
  allowed_origins: string[];
  revoked_at: Date | null;
};

function widgetAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const key = c.req.header("x-kanso-key") ?? c.req.query("key");
    if (!key || !/^pk_(live|test)_[A-Za-z0-9_-]{10,}$/.test(key)) {
      throw new HttpError(401, "invalid_widget_key");
    }
    const res = await getPool().query<KeyRow>(
      `select k.id, k.tenant_id, k.mode, k.allowed_origins, k.revoked_at
       from widget_keys k join tenants t on t.tenant_id = k.tenant_id
       where k.public_key = $1 and t.deleted_at is null`,
      [key],
    );
    const row = res.rows[0];
    if (!row || row.revoked_at) throw new HttpError(401, "invalid_widget_key");

    const origin = c.req.header("origin") ?? null;
    if (origin && !isOriginAllowed(origin, row)) {
      throw new HttpError(403, "origin_not_allowed", "Ce site n'est pas autorisé à utiliser cet assistant.");
    }
    const ctx: WidgetContext = { tenantId: row.tenant_id, keyId: row.id, mode: row.mode, origin };
    c.set("widget", ctx);
    await next();
  };
}

function isOriginAllowed(origin: string, row: KeyRow): boolean {
  const norm = origin.replace(/\/$/, "");
  // The dashboard preview and onboarding check always work.
  if (norm === appUrl()) return true;
  if (isLocalOrigin(norm) && (row.mode === "test" || !isProd())) return true;
  // Empty allowlist = not yet restricted (the dashboard nudges owners to set it).
  if (row.allowed_origins.length === 0) return true;
  return originMatches(norm, row.allowed_origins);
}

function widgetCtx(c: { get: (k: "widget") => WidgetContext | undefined }): WidgetContext {
  const w = c.get("widget");
  if (!w) throw new Error("widgetAuth missing");
  return w;
}

export function widgetRoutes(limiter: RateLimiter, deps: InboundDeps = {}) {
  const app = new Hono<AppEnv>();

  app.get("/widget/kanso-widget.js", (c) => {
    const bundle = loadWidgetBundle();
    if (!bundle) return c.text("widget not built — run pnpm --filter @kanso/inbound-widget build", 404);
    c.header("Content-Type", "application/javascript; charset=utf-8");
    c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    c.header("ETag", bundle.etag);
    c.header("Cross-Origin-Resource-Policy", "cross-origin");
    if (c.req.header("if-none-match") === bundle.etag) return c.body(null, 304);
    return c.body(new Uint8Array(bundle.body));
  });

  // Public widget API: any origin may call; the per-key allowlist decides.
  app.use(
    "/v1/widget/*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-Kanso-Key"],
      maxAge: 600,
    }),
  );
  app.use("/v1/widget/*", widgetAuth());

  app.get("/v1/widget/config", async (c) => {
    const w = widgetCtx(c);
    const pool = getPool();
    const [published, ent] = await Promise.all([loadInboundConfig(w.tenantId, deps), getEntitlements(pool, w.tenantId)]);
    const available = !!published && ent.active && ent.modules.inbound;
    c.header("Cache-Control", "public, max-age=60");
    if (!published) {
      return c.json({ available: false, unavailable_message: UNAVAILABLE_MESSAGE });
    }
    const cfg = published.config;
    const now = new Date();
    return c.json({
      available,
      unavailable_message: available ? null : UNAVAILABLE_MESSAGE,
      version: published.version,
      display_name: cfg.identity.display_name,
      locale: cfg.identity.locale_default,
      primary_color: cfg.identity.branding.primary_color,
      logo_url: cfg.identity.branding.logo_url ?? null,
      welcome_message: cfg.identity.welcome_message ?? null,
      ai_notice: cfg.disclosure.ai_notice,
      open_now: isWithinBusinessHours(cfg, now),
      blocked_now: blocksAfterHours(cfg, now),
      after_hours_message: blocksAfterHours(cfg, now) ? resolveAfterHoursMessage(cfg) : null,
      privacy_url: `${appUrl()}/legal/confidentialite-widget`,
    });
  });

  app.post(
    "/v1/widget/ping",
    rateLimit(limiter, { name: "widget_ping", limit: 30, windowSec: 60 }),
    async (c) => {
      const w = widgetCtx(c);
      if (w.origin && !isLocalOrigin(w.origin) && w.origin !== appUrl()) {
        await getPool().query(
          `update widget_keys set last_seen_at = now(), last_seen_origin = $2 where id = $1`,
          [w.keyId, w.origin.slice(0, 200)],
        );
      }
      return c.json({ ok: true });
    },
  );

  app.post(
    "/v1/widget/sessions",
    rateLimit(limiter, { name: "widget_session", limit: 10, windowSec: 60, key: (c) => `${clientIp(c)}` }),
    async (c) => {
      const w = widgetCtx(c);
      const started = await startInboundSession(w.tenantId, deps, { origin: w.origin });
      if (!started.ok) {
        return c.json({ error: started.error, assistant_message: started.assistantMessage }, 503);
      }
      return c.json({
        session_id: started.sessionId,
        state: started.state,
        assistant_message: started.assistantMessage,
        after_hours: started.afterHours,
        expected_question: started.expectedQuestion,
      });
    },
  );

  app.get("/v1/widget/sessions/:sessionId/messages", async (c) => {
    const w = widgetCtx(c);
    const sessionId = SESSION_ID.safeParse(c.req.param("sessionId"));
    if (!sessionId.success) throw notFound("session_not_found");
    const pool = getPool();
    const store = deps.sessionStore ?? new PostgresSessionStore(pool);
    const session = await store.getActive(w.tenantId, sessionId.data);
    if (!session) throw notFound("session_not_found");
    const published = await loadInboundConfig(w.tenantId, deps);
    const transcript = await store.transcript(w.tenantId, sessionId.data);
    return c.json({
      session_id: session.id,
      state: session.state,
      messages: transcript.map((m) => ({ role: m.role, content: m.content })),
      expected_question: published ? resolveExpectedQuestion(published.config, session) : null,
    });
  });

  app.post(
    "/v1/widget/sessions/:sessionId/messages",
    rateLimit(limiter, {
      name: "widget_msg",
      limit: 20,
      windowSec: 60,
      key: (c) => `${c.req.param("sessionId")}:${clientIp(c)}`,
    }),
    async (c) => {
      const w = widgetCtx(c);
      const sessionId = SESSION_ID.safeParse(c.req.param("sessionId"));
      if (!sessionId.success) throw notFound("session_not_found");
      const body = z
        .object({ text: z.string().trim().min(1).max(2000) })
        .safeParse(await c.req.json().catch(() => ({})));
      if (!body.success) throw new HttpError(400, "text_required");

      const out = await runInboundTurn(w.tenantId, sessionId.data, body.data.text, deps);
      switch (out.kind) {
        case "not_found":
          throw notFound("session_not_found");
        case "no_config":
          return c.json({ error: "unavailable", assistant_message: UNAVAILABLE_MESSAGE }, 503);
        case "after_hours":
          return c.json({ error: "after_hours", after_hours: true, assistant_message: out.assistantMessage, state: out.state }, 403);
        case "quota_exceeded":
          return c.json({ error: "quota_exceeded", assistant_message: out.assistantMessage }, 429);
        case "unavailable":
          return c.json({ error: "unavailable", assistant_message: out.assistantMessage }, 503);
        case "ok":
          return c.json({
            session_id: out.sessionId,
            state: out.state,
            assistant_message: out.assistantMessage,
            expected_question: out.expectedQuestion,
            closed: out.state.startsWith("Closed"),
          });
      }
    },
  );

  return app;
}
