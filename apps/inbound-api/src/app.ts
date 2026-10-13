import { randomUUID } from "node:crypto";
import { getPool } from "@kanso/tenancy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { csrfGuard, loadSession, requireUser, requireWorkspace } from "./auth/middleware.js";
import { resolveCorsOrigin } from "./cors-origins.js";
import { devToolsEnabled, legacyWidgetEnabled } from "./env.js";
import { buildHealth } from "./health.js";
import { handleError } from "./http/errors.js";
import { RateLimiter } from "./http/rate-limit.js";
import type { AppEnv } from "./http/types.js";
import { adminRoutes } from "./routes/admin.js";
import { assistantRoutes } from "./routes/app/assistant.js";
import { billingRoutes } from "./routes/app/billing.js";
import { documentsRoutes } from "./routes/app/documents.js";
import { integrationsRoutes } from "./routes/app/integrations.js";
import { leadsRoutes } from "./routes/app/leads.js";
import { overviewRoutes } from "./routes/app/overview.js";
import { settingsRoutes } from "./routes/app/settings.js";
import { teamRoutes } from "./routes/app/team.js";
import { authRoutes } from "./routes/auth.js";
import { devRoutes } from "./routes/dev.js";
import { legacyRoutes } from "./routes/legacy.js";
import { publicRoutes } from "./routes/public.js";
import { stripeRoutes } from "./routes/stripe.js";
import { widgetRoutes } from "./routes/widget.js";
import type { InboundDeps } from "./services/inbound.js";

export type AppDeps = InboundDeps;

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();
  const limiter = new RateLimiter(() => getPool());

  app.onError(handleError);
  app.notFound((c) => c.json({ error: "not_found" }, 404));

  app.use("*", async (c, next) => {
    const id = c.req.header("x-request-id")?.slice(0, 64) || randomUUID();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    const started = Date.now();
    await next();
    if (c.req.path !== "/health" && process.env.KANSO_ACCESS_LOG !== "0") {
      console.log(
        JSON.stringify({
          level: "info",
          event: "http",
          request_id: id,
          method: c.req.method,
          path: c.req.routePath === "/*" ? c.req.path : c.req.routePath,
          status: c.res.status,
          ms: Date.now() - started,
        }),
      );
    }
  });
  app.use(
    "*",
    secureHeaders({
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: false,
      xFrameOptions: false,
      referrerPolicy: "strict-origin-when-cross-origin",
    }),
  );
  // DENY framing by default; the document viewer opts into SAMEORIGIN.
  app.use("*", async (c, next) => {
    await next();
    if (!c.res.headers.has("X-Frame-Options")) c.res.headers.set("X-Frame-Options", "DENY");
  });

  app.get("/health", async (c) => c.json(await buildHealth()));

  // Public widget (own CORS + per-key origin allowlist).
  app.route("/", widgetRoutes(limiter, deps));
  if (legacyWidgetEnabled()) app.route("/", legacyRoutes(deps));

  // Stripe webhook: raw body, signature-verified, no session/CSRF.
  app.route("/api/stripe", stripeRoutes());

  // Credentialed API for the web app.
  app.use(
    "/api/*",
    cors({
      origin: (origin) => resolveCorsOrigin(origin ?? ""),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Accept", "X-Kanso-Internal"],
      maxAge: 600,
    }),
  );
  app.use("/api/*", loadSession);

  app.route("/api/public", publicRoutes(limiter, deps));
  app.route("/api/auth", authRoutes(limiter));
  app.route("/api/admin", adminRoutes());
  if (devToolsEnabled()) app.route("/api/dev", devRoutes());

  const ws = new Hono<AppEnv>();
  ws.use("*", requireUser, csrfGuard, requireWorkspace("member"));
  ws.route("/", overviewRoutes());
  ws.route("/leads", leadsRoutes());
  ws.route("/assistant", assistantRoutes(limiter));
  ws.route("/documents", documentsRoutes());
  ws.route("/team", teamRoutes());
  ws.route("/integrations", integrationsRoutes());
  ws.route("/billing", billingRoutes());
  ws.route("/settings", settingsRoutes());
  app.route("/api/app/:workspace", ws);

  return app;
}
