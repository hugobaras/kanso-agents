import {
  buildInboundTemplate,
  EMAIL_ALERT_SECRET_REF,
  InboundConfigSchema,
  parseInboundConfig,
  SLACK_ALERT_SECRET_REF,
  type InboundConfig,
  type Profession,
} from "@kanso/config";
import {
  createSession,
  orchestrateTurn,
  resolveExpectedQuestion,
  startQualification,
  type InboundSession,
} from "@kanso/inbound-engine";
import {
  getPool,
  listConfigVersions,
  loadDraftConfig,
  loadPublishedConfig,
  PostgresSecretStore,
  publishConfig,
  saveDraftConfig,
} from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertActive, assertModule, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { apiPublicUrl, masterKey } from "../../env.js";
import { body } from "../../http/body.js";
import { badRequest, notFound } from "../../http/errors.js";
import type { RateLimiter } from "../../http/rate-limit.js";
import { rateLimit } from "../../http/rate-limit.js";
import type { AppEnv } from "../../http/types.js";
import { resolveLlmClient } from "../../services/inbound.js";
import { newWidgetPublicKey } from "../../services/workspaces.js";

async function currentDraft(tenantId: string, profession: string | null, displayName: string): Promise<{
  config: InboundConfig;
  source: "draft" | "published" | "template";
}> {
  const pool = getPool();
  const draft = await loadDraftConfig(pool, tenantId, "inbound");
  if (draft) {
    const parsed = InboundConfigSchema.safeParse(draft.config);
    if (parsed.success) return { config: parsed.data, source: "draft" };
  }
  const published = await loadPublishedConfig(pool, tenantId, "inbound");
  if (published) return { config: parseInboundConfig(published.config), source: "published" };
  return {
    config: buildInboundTemplate({ profession: (profession ?? "autre") as Profession, displayName }),
    source: "template",
  };
}

/** Apply an alert-channel change to both the draft and the live config. */
async function applyToDraftAndPublished(
  tenantId: string,
  actor: string,
  fallback: { profession: string | null; displayName: string },
  mutate: (cfg: InboundConfig) => InboundConfig,
): Promise<number | null> {
  const pool = getPool();
  const draft = await currentDraft(tenantId, fallback.profession, fallback.displayName);
  await saveDraftConfig(pool, { tenantId, product: "inbound", config: mutate(draft.config), updatedBy: actor });
  const published = await loadPublishedConfig(pool, tenantId, "inbound");
  if (!published) return null;
  const next = mutate(parseInboundConfig(published.config));
  return publishConfig(pool, { tenantId, product: "inbound", config: parseInboundConfig(next), publishedBy: actor });
}

function setChannel(
  cfg: InboundConfig,
  type: "email" | "slack",
  patch: { enabled?: boolean; on?: InboundConfig["alerts"]["channels"][number]["on"] } | null,
): InboundConfig {
  const channels = cfg.alerts.channels.filter((c) => c.type !== type);
  if (patch) {
    const existing = cfg.alerts.channels.find((c) => c.type === type);
    channels.push({
      type,
      secret_ref: type === "email" ? EMAIL_ALERT_SECRET_REF : SLACK_ALERT_SECRET_REF,
      on: patch.on ?? existing?.on ?? (type === "email" ? ["hot_lead", "handoff", "new_lead", "escalation"] : ["hot_lead", "escalation"]),
      enabled: patch.enabled ?? existing?.enabled ?? true,
    });
  }
  return { ...cfg, alerts: { ...cfg.alerts, channels } };
}

const PreviewSession = z.object({
  state: z.string(),
  answers: z.record(z.unknown()),
  scoreCurrent: z.number(),
  scoreFinal: z.number().nullable(),
  messages: z.array(z.string()).max(60),
});

export function assistantRoutes(limiter: RateLimiter) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    assertModule(c, "inbound");
    await next();
  });

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const pool = getPool();
    const [draft, published, versions] = await Promise.all([
      currentDraft(ws.tenantId, ws.profession, ws.displayName),
      loadPublishedConfig(pool, ws.tenantId, "inbound"),
      listConfigVersions(pool, ws.tenantId, "inbound", 10),
    ]);
    const publishedConfig = published ? parseInboundConfig(published.config) : null;
    return c.json({
      draft: draft.config,
      draft_source: draft.source,
      published: publishedConfig,
      published_version: published?.version ?? null,
      published_at: published?.published_at ?? null,
      has_unpublished_changes: !publishedConfig || JSON.stringify(publishedConfig) !== JSON.stringify(draft.config),
      versions,
    });
  });

  app.put("/draft", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(c.req, z.object({ config: z.unknown() }));
    const parsed = InboundConfigSchema.safeParse(b.config);
    if (!parsed.success) {
      throw badRequest(
        "invalid_config",
        "La configuration contient des erreurs.",
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      );
    }
    // Alert channels are managed by the dedicated endpoints (secrets).
    const current = await currentDraft(ws.tenantId, ws.profession, ws.displayName);
    const questionIds = new Set(parsed.data.qualification.questions.map((q) => q.id));
    const weights = Object.fromEntries(
      Object.entries(parsed.data.scoring.weights).filter(([id]) => questionIds.has(id)),
    );
    const config: InboundConfig = {
      ...parsed.data,
      scoring: { ...parsed.data.scoring, weights },
      alerts: current.config.alerts,
      product: "inbound",
    };
    validateScoringCoherence(config);
    await saveDraftConfig(getPool(), { tenantId: ws.tenantId, product: "inbound", config, updatedBy: actorLabel(c) });
    return c.json({ ok: true, config });
  });

  app.post("/publish", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    assertActive(c);
    const draft = await currentDraft(ws.tenantId, ws.profession, ws.displayName);
    validateScoringCoherence(draft.config);
    const pool = getPool();
    const version = await publishConfig(pool, {
      tenantId: ws.tenantId,
      product: "inbound",
      config: draft.config,
      publishedBy: actorLabel(c),
    });
    await saveDraftConfig(pool, { tenantId: ws.tenantId, product: "inbound", config: draft.config, updatedBy: actorLabel(c) });
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "config", decision: "inbound_published", summary: { version } });
    return c.json({ ok: true, version });
  });

  app.post("/restore/:version", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const version = Number(c.req.param("version"));
    const res = await getPool().query<{ config: unknown }>(
      `select config from tenant_configs where tenant_id = $1 and product = 'inbound' and version = $2`,
      [ws.tenantId, version],
    );
    if (!res.rows[0]) throw notFound("version_not_found");
    const cfg = parseInboundConfig(res.rows[0].config);
    await saveDraftConfig(getPool(), { tenantId: ws.tenantId, product: "inbound", config: cfg, updatedBy: actorLabel(c) });
    return c.json({ ok: true, config: cfg });
  });

  /** Stateless preview of the draft: the client holds the session object. */
  app.post(
    "/preview",
    rateLimit(limiter, { name: "assistant_preview", limit: 40, windowSec: 60, key: (c) => currentUser(c).id }),
    async (c) => {
      const ws = currentWorkspace(c);
      const b = await body(
        c.req,
        z.object({ config: z.unknown().optional(), session: PreviewSession.optional(), text: z.string().max(2000).optional() }),
      );
      const config = b.config
        ? parseInboundConfig(b.config)
        : (await currentDraft(ws.tenantId, ws.profession, ws.displayName)).config;
      const previewConfig: InboundConfig = { ...config, operations: { ...config.operations, after_hours_mode: "qualify" } };
      if (!b.session || !b.text) {
        const started = startQualification(createSession("preview", ws.tenantId, 0), previewConfig);
        return c.json({
          session: pickSession(started.session),
          assistant_message: started.assistantMessage,
          expected_question: resolveExpectedQuestion(previewConfig, started.session),
        });
      }
      const session: InboundSession = {
        id: "00000000-0000-4000-8000-00000000beef",
        tenantId: ws.tenantId,
        configVersion: 0,
        ...b.session,
        state: b.session.state as InboundSession["state"],
      };
      const turn = await orchestrateTurn({
        session,
        config: previewConfig,
        userText: b.text,
        llm: resolveLlmClient(previewConfig).client,
      });
      const score = turn.session.scoreFinal ?? turn.session.scoreCurrent;
      return c.json({
        session: pickSession(turn.session),
        assistant_message: turn.assistantMessage,
        expected_question: resolveExpectedQuestion(previewConfig, turn.session),
        closed: turn.session.state.startsWith("Closed"),
        alert_event: turn.alertEvent ?? null,
        score,
        tier: score >= config.scoring.thresholds.hot ? "hot" : score >= config.scoring.thresholds.warm ? "warm" : "cold",
      });
    },
  );

  // Alerts -------------------------------------------------------------------
  app.get("/alerts", async (c) => {
    const ws = currentWorkspace(c);
    const store = new PostgresSecretStore(getPool(), masterKey());
    const draft = await currentDraft(ws.tenantId, ws.profession, ws.displayName);
    const [emailHints, slackHints] = await Promise.all([
      store.peekHints(ws.tenantId, EMAIL_ALERT_SECRET_REF),
      store.peekHints(ws.tenantId, SLACK_ALERT_SECRET_REF),
    ]);
    const ch = (t: "email" | "slack") => draft.config.alerts.channels.find((x) => x.type === t);
    return c.json({
      email: {
        configured: !!emailHints && !!ch("email"),
        enabled: ch("email")?.enabled !== false && !!ch("email"),
        recipients: emailHints?.to ? emailHints.to.split(/[,;\s]+/).filter(Boolean) : [],
        on: ch("email")?.on ?? ["hot_lead", "handoff", "new_lead", "escalation"],
      },
      slack: {
        configured: !!slackHints && !!ch("slack"),
        enabled: ch("slack")?.enabled !== false && !!ch("slack"),
        webhook_masked: slackHints?.webhook_masked ?? null,
        on: ch("slack")?.on ?? ["hot_lead", "escalation"],
      },
      slack_allowed: ws.entitlements.plan.integrations !== "email",
    });
  });

  const EVENTS = z.array(z.enum(["new_lead", "hot_lead", "escalation", "handoff"])).min(1);

  app.put("/alerts/email", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(
      c.req,
      z.object({ recipients: z.array(z.string().trim().toLowerCase().email()).min(1).max(5), on: EVENTS.optional(), enabled: z.boolean().optional() }),
    );
    await new PostgresSecretStore(getPool(), masterKey()).put(ws.tenantId, EMAIL_ALERT_SECRET_REF, {
      to: b.recipients.join(","),
    });
    const version = await applyToDraftAndPublished(ws.tenantId, actorLabel(c), ws, (cfg) =>
      setChannel(cfg, "email", { on: b.on, enabled: b.enabled ?? true }),
    );
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "alerts", decision: "email_saved", summary: { count: b.recipients.length } });
    return c.json({ ok: true, version });
  });

  app.put("/alerts/slack", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    if (ws.entitlements.plan.integrations === "email") {
      throw badRequest("plan_upgrade_required", "Les alertes Slack sont disponibles à partir de l'offre Cabinet.");
    }
    const b = await body(
      c.req,
      z.object({
        webhook_url: z.string().url().startsWith("https://hooks.slack.com/", "URL de webhook Slack attendue (https://hooks.slack.com/…)").optional(),
        on: EVENTS.optional(),
        enabled: z.boolean().optional(),
      }),
    );
    const store = new PostgresSecretStore(getPool(), masterKey());
    if (b.webhook_url) await store.put(ws.tenantId, SLACK_ALERT_SECRET_REF, { webhook_url: b.webhook_url });
    else if (!(await store.exists(ws.tenantId, SLACK_ALERT_SECRET_REF))) throw badRequest("webhook_required", "Indiquez l'URL du webhook Slack.");
    const version = await applyToDraftAndPublished(ws.tenantId, actorLabel(c), ws, (cfg) =>
      setChannel(cfg, "slack", { on: b.on, enabled: b.enabled ?? true }),
    );
    return c.json({ ok: true, version });
  });

  app.delete("/alerts/:type", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const type = z.enum(["email", "slack"]).parse(c.req.param("type"));
    await new PostgresSecretStore(getPool(), masterKey()).delete(
      ws.tenantId,
      type === "email" ? EMAIL_ALERT_SECRET_REF : SLACK_ALERT_SECRET_REF,
    );
    const version = await applyToDraftAndPublished(ws.tenantId, actorLabel(c), ws, (cfg) => setChannel(cfg, type, null));
    return c.json({ ok: true, version });
  });

  // Install / widget keys --------------------------------------------------------
  app.get("/install", async (c) => {
    const ws = currentWorkspace(c);
    const res = await getPool().query<{
      id: string;
      public_key: string;
      allowed_origins: string[];
      last_seen_at: Date | null;
      last_seen_origin: string | null;
      created_at: Date;
    }>(
      `select id, public_key, allowed_origins, last_seen_at, last_seen_origin, created_at
       from widget_keys where tenant_id = $1 and revoked_at is null and mode = 'live'
       order by created_at desc limit 1`,
      [ws.tenantId],
    );
    let key = res.rows[0];
    if (!key) {
      const created = await getPool().query<NonNullable<typeof key>>(
        `insert into widget_keys (tenant_id, public_key, mode) values ($1, $2, 'live')
         returning id, public_key, allowed_origins, last_seen_at, last_seen_origin, created_at`,
        [ws.tenantId, newWidgetPublicKey("live")],
      );
      key = created.rows[0]!;
    }
    const scriptUrl = `${apiPublicUrl()}/widget/kanso-widget.js`;
    return c.json({
      key_id: key.id,
      public_key: key.public_key,
      allowed_origins: key.allowed_origins,
      last_seen_at: key.last_seen_at,
      last_seen_origin: key.last_seen_origin,
      script_url: scriptUrl,
      api_url: apiPublicUrl(),
      snippet: `<script src="${scriptUrl}" data-key="${key.public_key}" data-api="${apiPublicUrl()}" async></script>`,
    });
  });

  app.put("/install/origins", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(
      c.req,
      z.object({
        origins: z
          .array(
            z
              .string()
              .trim()
              .toLowerCase()
              .regex(/^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d+)?$/, "Format attendu : https://www.mon-cabinet.fr"),
          )
          .max(10),
      }),
    );
    await getPool().query(
      `update widget_keys set allowed_origins = $2 where tenant_id = $1 and revoked_at is null and mode = 'live'`,
      [ws.tenantId, [...new Set(b.origins.map((o) => o.replace(/\/$/, "")))]],
    );
    return c.json({ ok: true });
  });

  app.post("/install/rotate", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const pool = getPool();
    const prev = await pool.query<{ allowed_origins: string[] }>(
      `update widget_keys set revoked_at = now() where tenant_id = $1 and revoked_at is null and mode = 'live'
       returning allowed_origins`,
      [ws.tenantId],
    );
    await pool.query(`insert into widget_keys (tenant_id, public_key, mode, allowed_origins) values ($1, $2, 'live', $3)`, [
      ws.tenantId,
      newWidgetPublicKey("live"),
      prev.rows[0]?.allowed_origins ?? [],
    ]);
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "widget_key", decision: "rotated" });
    return c.json({ ok: true });
  });

  return app;
}

function pickSession(s: InboundSession) {
  return {
    state: s.state,
    answers: s.answers,
    scoreCurrent: s.scoreCurrent,
    scoreFinal: s.scoreFinal,
    messages: s.messages.slice(-40),
  };
}

/** Questions and weights must line up; thresholds must be ordered. */
export function validateScoringCoherence(cfg: InboundConfig) {
  const ids = new Set<string>();
  for (const q of cfg.qualification.questions) {
    if (ids.has(q.id)) throw badRequest("duplicate_question_id", `Identifiant de question en double : ${q.id}`);
    ids.add(q.id);
    if ((q.type === "single_choice" || q.type === "multi_choice") && (!q.options || q.options.length < 2)) {
      throw badRequest("options_required", `La question « ${q.prompt} » doit proposer au moins deux choix.`);
    }
  }
  const t = cfg.scoring.thresholds;
  if (!(t.hot > t.warm && t.warm >= t.cold)) {
    throw badRequest("invalid_thresholds", "Les seuils doivent respecter : prioritaire > à suivre ≥ froid.");
  }
}
