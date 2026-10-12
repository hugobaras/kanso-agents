import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createSession,
  InboundHeuristicLlmClient,
  newSessionId,
  orchestrateTurn,
  PostgresSessionStore,
  resolveExpectedQuestion,
  startQualification,
} from "@kanso/inbound-engine";
import { parseInboundConfig, type InboundConfig } from "@kanso/config";
import type { LlmClient } from "@kanso/llm";
import {
  createLlmClient,
  FallbackLlmClient,
  MeteringLlmClient,
  RetryLlmClient,
} from "@kanso/llm";
import { getPool, requireTenantId } from "@kanso/tenancy";
import { dispatchInboundAlert } from "./alerts.js";
import {
  listDemoOps,
  patchLatestAlert,
  recordDemoTurn,
} from "./demo-ops.js";
import { mountDocumentRoutes } from "./documents.js";
import { syncInboundIntegrations } from "./integrations.js";
import { resolveRag } from "./rag.js";
import { flushMeteredUsage } from "./usage.js";

const here = dirname(fileURLToPath(import.meta.url));
const widgetJsCandidates = [
  join(here, "../../inbound-widget/dist/kanso-widget.js"),
  join(process.cwd(), "apps/inbound-widget/dist/kanso-widget.js"),
];
const demoHtmlCandidates = [
  join(here, "../../inbound-widget/public/demo.html"),
  join(process.cwd(), "apps/inbound-widget/public/demo.html"),
];

function firstExisting(paths: string[]): string | null {
  return paths.find((p) => existsSync(p)) ?? null;
}

export type AppDeps = {
  getPublishedInboundConfig?: (
    tenantId: string,
  ) => Promise<{ config: unknown; version: number } | null>;
  sessionStore?: PostgresSessionStore;
  llm?: LlmClient;
};

async function loadPublishedConfig(
  tenantId: string,
  deps: AppDeps,
): Promise<{ config: unknown; version: number } | null> {
  if (deps.getPublishedInboundConfig) {
    return deps.getPublishedInboundConfig(tenantId);
  }
  const pool = getPool();
  const res = await pool.query<{ config: unknown; version: number }>(
    `select config, version from tenant_configs
     where tenant_id = $1 and product = 'inbound' and status = 'published'
     order by version desc limit 1`,
    [tenantId],
  );
  return res.rows[0] ?? null;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Accept"],
    }),
  );

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "inbound-api",
      env: process.env.KANSO_ENV ?? "local",
    }),
  );

  app.get("/widget/kanso-widget.js", (c) => {
    const path = firstExisting(widgetJsCandidates);
    if (!path) return c.text("widget not built — run pnpm --filter @kanso/inbound-widget build", 404);
    c.header("Content-Type", "application/javascript; charset=utf-8");
    c.header("Cache-Control", "no-store");
    return c.body(readFileSync(path));
  });

  app.get("/demo", (c) => {
    const path = firstExisting(demoHtmlCandidates);
    if (!path) return c.text("demo.html missing", 404);
    return c.html(readFileSync(path, "utf8"));
  });

  /** Ops démo : tours + alertes en mémoire (valeur cabinet visible). */
  app.get("/demo/ops", (c) =>
    c.json({
      ok: true,
      events: listDemoOps(50),
      hint: "Alertes console = mode démo sans SMTP ; le contenu est ici.",
    }),
  );

  mountDocumentRoutes(app);

  app.post("/v1/:tenantId/sessions", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const pool = getPool();
    const store = deps.sessionStore ?? new PostgresSessionStore(pool);
    const published = await loadPublishedConfig(tenantId, deps);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }

    const config = parseInboundConfig(published.config);
    const session = createSession(
      newSessionId(),
      tenantId,
      published.version,
    );
    const started = startQualification(session, config, { now: new Date() });
    await store.create(started.session);
    const expected = resolveExpectedQuestion(config, started.session);

    return c.json({
      session_id: started.session.id,
      state: started.session.state,
      assistant_message: started.assistantMessage,
      after_hours: started.afterHours,
      expected_question: expected,
    });
  });

  app.post("/v1/:tenantId/sessions/:sessionId/messages", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const sessionId = c.req.param("sessionId");
    const body = (await c.req.json().catch(() => ({}))) as { text?: string };
    if (!body.text?.trim()) {
      return c.json({ error: "text_required" }, 400);
    }

    const pool = getPool();
    const store = deps.sessionStore ?? new PostgresSessionStore(pool);
    const session = await store.getActive(tenantId, sessionId);
    if (!session) {
      return c.json({ error: "session_not_found" }, 404);
    }

    const published = await loadPublishedConfig(tenantId, deps);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }
    const config = parseInboundConfig(published.config);
    const metering = new MeteringLlmClient(
      deps.llm ?? resolveLlmClient(config),
    );

    const turn = await orchestrateTurn({
      session,
      config,
      userText: body.text,
      llm: metering,
      rag: resolveRag(tenantId),
    });
    await store.save(turn.session);

    await pool.query(
      `insert into inbound_messages (session_id, tenant_id, role, content)
       values ($1::uuid, $2, 'user', $3), ($1::uuid, $2, 'assistant', $4)`,
      [sessionId, tenantId, body.text, turn.assistantMessage],
    );

    let usage = {
      recorded: 0,
      dayTotalEur: 0,
      softCapBreached: false,
    };
    try {
      usage = await flushMeteredUsage({
        tenantId,
        correlationId: sessionId,
        metering,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "usage_ledger_failed",
          tenant_id: tenantId,
          correlation_id: sessionId,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    let alert:
      | { delivered: boolean; mode: string; error?: string; channels?: unknown }
      | null = null;
    let integrations: Awaited<ReturnType<typeof syncInboundIntegrations>> | null =
      null;
    if (turn.alertEvent) {
      alert = await dispatchInboundAlert({
        tenantId,
        sessionId,
        configVersion: published.version,
        config,
        event: turn.alertEvent,
        scoreFinal: turn.session.scoreFinal,
        answers: turn.session.answers,
      });
      integrations = await syncInboundIntegrations({
        tenantId,
        sessionId,
        configVersion: published.version,
        config,
        session: turn.session,
      });
    }

    const expected = resolveExpectedQuestion(config, turn.session);

    if (turn.alertEvent && integrations) {
      patchLatestAlert(sessionId, { integrations });
    }

    const score =
      turn.session.scoreFinal ?? turn.session.scoreCurrent;
    const band =
      score >= config.scoring.thresholds.hot
        ? "hot"
        : score >= config.scoring.thresholds.warm
          ? "warm"
          : "cold";

    recordDemoTurn({
      tenant_id: tenantId,
      session_id: turn.session.id,
      state: turn.session.state,
      intent: turn.intent,
      score_current: turn.session.scoreCurrent,
      score_final: turn.session.scoreFinal,
      answers: turn.session.answers,
      user_text: body.text,
      assistant_message: turn.assistantMessage,
      alert_event: turn.alertEvent ?? null,
    });

    return c.json({
      session_id: turn.session.id,
      state: turn.session.state,
      score_current: turn.session.scoreCurrent,
      score_final: turn.session.scoreFinal,
      score_band: band,
      score_thresholds: config.scoring.thresholds,
      answers: turn.session.answers,
      intent: turn.intent,
      alert_event: turn.alertEvent ?? null,
      alert,
      integrations,
      assistant_message: turn.assistantMessage,
      expected_question: expected,
      tenant_display_name: config.identity.display_name,
      llm_provider: process.env.MISTRAL_API_KEY ? "mistral" : "heuristic",
      usage: {
        calls: usage.recorded,
        day_total_eur: usage.dayTotalEur,
        soft_cap_breached: usage.softCapBreached,
      },
    });
  });

  return app;
}

/**
 * D-093: Mistral with retries, then heuristic filet only if still failing.
 */
function resolveLlmClient(config: InboundConfig): LlmClient {
  const heuristic = new InboundHeuristicLlmClient(config);
  if (!process.env.MISTRAL_API_KEY) {
    return heuristic;
  }
  const primary = new RetryLlmClient(createLlmClient(), {
    maxAttempts: 3,
    baseDelayMs: 500,
  });
  return new FallbackLlmClient(primary, heuristic, (err) => {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "llm_primary_failed_fallback_heuristic",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  });
}
