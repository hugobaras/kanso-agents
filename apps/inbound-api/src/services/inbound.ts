import { consumeQuota, getEntitlements } from "@kanso/billing";
import { parseInboundConfig, type InboundConfig } from "@kanso/config";
import {
  blocksAfterHours,
  createSession,
  InboundHeuristicLlmClient,
  newSessionId,
  orchestrateTurn,
  PostgresSessionStore,
  resolveAfterHoursMessage,
  resolveExpectedQuestion,
  startQualification,
  type ExpectedQuestionPayload,
} from "@kanso/inbound-engine";
import {
  createLlmClient,
  FallbackLlmClient,
  MeteringLlmClient,
  RetryLlmClient,
  type LlmClient,
} from "@kanso/llm";
import { getPool, loadPublishedConfig, type Pool } from "@kanso/tenancy";
import { dispatchInboundAlert } from "../alerts.js";
import { syncInboundIntegrations } from "../integrations.js";
import { resolveRag } from "../rag.js";
import { flushMeteredUsage } from "../usage.js";
import { upsertLead } from "./leads.js";
import { notifyQuota } from "./notifications.js";

export type InboundDeps = {
  getPublishedInboundConfig?: (tenantId: string) => Promise<{ config: unknown; version: number } | null>;
  sessionStore?: PostgresSessionStore;
  llm?: LlmClient;
  now?: () => Date;
};

export const UNAVAILABLE_MESSAGE =
  "L'assistant de ce cabinet est momentanément indisponible. Merci de contacter le cabinet directement.";
export const QUOTA_MESSAGE =
  "L'assistant ne peut pas prendre de nouvelle demande pour le moment. Merci de contacter le cabinet directement par e-mail ou téléphone.";

export async function loadInboundConfig(
  tenantId: string,
  deps: InboundDeps,
): Promise<{ config: InboundConfig; version: number } | null> {
  const published = deps.getPublishedInboundConfig
    ? await deps.getPublishedInboundConfig(tenantId)
    : await loadPublishedConfig(getPool(), tenantId, "inbound");
  if (!published) return null;
  return { config: parseInboundConfig(published.config), version: published.version };
}

/** D-093: Mistral with retries, heuristic only as a safety net. */
export function resolveLlmClient(config: InboundConfig): { client: LlmClient; provider: "mistral" | "heuristic" } {
  const heuristic = new InboundHeuristicLlmClient(config);
  if (!process.env.MISTRAL_API_KEY) return { client: heuristic, provider: "heuristic" };
  const primary = new RetryLlmClient(createLlmClient(), { maxAttempts: 3, baseDelayMs: 500 });
  return {
    client: new FallbackLlmClient(primary, heuristic, (err) => {
      console.error(
        JSON.stringify({
          level: "warn",
          event: "llm_primary_failed_fallback_heuristic",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }),
    provider: "mistral",
  };
}

export type StartResult =
  | {
      ok: true;
      sessionId: string;
      state: string;
      assistantMessage: string;
      afterHours: boolean;
      expectedQuestion: ExpectedQuestionPayload | null;
    }
  | { ok: false; error: "no_published_inbound_config" | "unavailable"; assistantMessage: string };

export async function startInboundSession(
  tenantId: string,
  deps: InboundDeps,
  opts: { origin?: string | null; checkEntitlements?: boolean } = {},
): Promise<StartResult> {
  const pool = getPool();
  if (opts.checkEntitlements !== false) {
    const ent = await getEntitlements(pool, tenantId);
    if (!ent.active || !ent.modules.inbound) {
      return { ok: false, error: "unavailable", assistantMessage: UNAVAILABLE_MESSAGE };
    }
  }
  const published = await loadInboundConfig(tenantId, deps);
  if (!published) {
    return { ok: false, error: "no_published_inbound_config", assistantMessage: UNAVAILABLE_MESSAGE };
  }
  const store = deps.sessionStore ?? new PostgresSessionStore(pool);
  const session = createSession(newSessionId(), tenantId, published.version);
  const started = startQualification(session, published.config, { now: deps.now?.() ?? new Date() });
  await store.create(started.session);
  if (opts.origin) {
    await pool.query(`update inbound_sessions set origin = $2 where id = $1::uuid`, [
      started.session.id,
      opts.origin.slice(0, 200),
    ]);
  }
  await pool.query(
    `insert into inbound_messages (session_id, tenant_id, role, content) values ($1::uuid, $2, 'assistant', $3)`,
    [started.session.id, tenantId, started.assistantMessage],
  );
  return {
    ok: true,
    sessionId: started.session.id,
    state: started.session.state,
    assistantMessage: started.assistantMessage,
    afterHours: started.afterHours,
    expectedQuestion: started.afterHours ? null : resolveExpectedQuestion(published.config, started.session),
  };
}

export type TurnOutcome =
  | { kind: "not_found" }
  | { kind: "no_config" }
  | { kind: "after_hours"; assistantMessage: string; state: string }
  | { kind: "quota_exceeded"; assistantMessage: string }
  | { kind: "unavailable"; assistantMessage: string }
  | {
      kind: "ok";
      sessionId: string;
      state: string;
      assistantMessage: string;
      expectedQuestion: ExpectedQuestionPayload | null;
      scoreCurrent: number;
      scoreFinal: number | null;
      scoreBand: "hot" | "warm" | "cold";
      answers: Record<string, unknown>;
      intent: string;
      alertEvent: string | null;
      alert: unknown;
      integrations: unknown;
      leadId: string | null;
      llmProvider: "mistral" | "heuristic" | "injected";
      displayName: string;
      thresholds: InboundConfig["scoring"]["thresholds"];
      usage: { calls: number; day_total_eur: number; soft_cap_breached: boolean };
    };

/** Count the conversation against the monthly quota on its first user message. */
async function countConversation(pool: Pool, tenantId: string, sessionId: string): Promise<boolean> {
  const marked = await pool.query(
    `update inbound_sessions set counted_at = now() where id = $1::uuid and counted_at is null returning id`,
    [sessionId],
  );
  if (marked.rowCount === 0) return true; // already counted
  const ent = await getEntitlements(pool, tenantId);
  const quota = await consumeQuota(pool, tenantId, "conversations", ent.quotas.conversations);
  if (!quota.ok) {
    await pool.query(`update inbound_sessions set counted_at = null where id = $1::uuid`, [sessionId]);
    await notifyQuota(tenantId, "conversations", quota.used, quota.limit);
    return false;
  }
  await notifyQuota(tenantId, "conversations", quota.used, quota.limit);
  return true;
}

export async function runInboundTurn(
  tenantId: string,
  sessionId: string,
  text: string,
  deps: InboundDeps,
  opts: { checkEntitlements?: boolean } = {},
): Promise<TurnOutcome> {
  const pool = getPool();
  const store = deps.sessionStore ?? new PostgresSessionStore(pool);
  const session = await store.getActive(tenantId, sessionId);
  if (!session) return { kind: "not_found" };
  const published = await loadInboundConfig(tenantId, deps);
  if (!published) return { kind: "no_config" };
  const { config, version } = published;

  if (blocksAfterHours(config, deps.now?.() ?? new Date())) {
    return { kind: "after_hours", assistantMessage: resolveAfterHoursMessage(config), state: session.state };
  }

  if (opts.checkEntitlements !== false) {
    const ent = await getEntitlements(pool, tenantId);
    if (!ent.active || !ent.modules.inbound) {
      return { kind: "unavailable", assistantMessage: UNAVAILABLE_MESSAGE };
    }
    if (!(await countConversation(pool, tenantId, sessionId))) {
      return { kind: "quota_exceeded", assistantMessage: QUOTA_MESSAGE };
    }
  }

  const resolved = deps.llm
    ? { client: deps.llm, provider: "injected" as const }
    : resolveLlmClient(config);
  const metering = new MeteringLlmClient(resolved.client);
  const turn = await orchestrateTurn({
    session,
    config,
    userText: text,
    llm: metering,
    rag: resolveRag(tenantId),
  });
  await store.save(turn.session);
  // clock_timestamp() gives each row a distinct, ordered timestamp.
  await pool.query(
    `insert into inbound_messages (session_id, tenant_id, role, content, created_at)
     values ($1::uuid, $2, 'user', $3, clock_timestamp()), ($1::uuid, $2, 'assistant', $4, clock_timestamp())`,
    [sessionId, tenantId, text, turn.assistantMessage],
  );

  let usage = { recorded: 0, dayTotalEur: 0, softCapBreached: false };
  try {
    usage = await flushMeteredUsage({ tenantId, correlationId: sessionId, metering });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "usage_ledger_failed",
        tenant_id: tenantId,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  let alert: unknown = null;
  let integrations: unknown = null;
  let leadId: string | null = null;
  if (turn.alertEvent) {
    const lead = await upsertLead(pool, { tenantId, session: turn.session, config, event: turn.alertEvent });
    leadId = lead.id;
    alert = await dispatchInboundAlert({
      tenantId,
      sessionId,
      leadId: lead.id,
      tier: lead.tier,
      configVersion: version,
      config,
      event: turn.alertEvent,
      scoreFinal: turn.session.scoreFinal ?? turn.session.scoreCurrent,
      answers: turn.session.answers,
    });
    integrations = await syncInboundIntegrations({
      tenantId,
      sessionId,
      configVersion: version,
      config,
      session: turn.session,
    });
  }

  const score = turn.session.scoreFinal ?? turn.session.scoreCurrent;
  return {
    kind: "ok",
    sessionId: turn.session.id,
    state: turn.session.state,
    assistantMessage: turn.assistantMessage,
    expectedQuestion: resolveExpectedQuestion(config, turn.session),
    scoreCurrent: turn.session.scoreCurrent,
    scoreFinal: turn.session.scoreFinal,
    scoreBand: score >= config.scoring.thresholds.hot ? "hot" : score >= config.scoring.thresholds.warm ? "warm" : "cold",
    answers: turn.session.answers,
    intent: turn.intent,
    alertEvent: turn.alertEvent ?? null,
    alert,
    integrations,
    leadId,
    llmProvider: resolved.provider,
    displayName: config.identity.display_name,
    thresholds: config.scoring.thresholds,
    usage: {
      calls: usage.recorded,
      day_total_eur: usage.dayTotalEur,
      soft_cap_breached: usage.softCapBreached,
    },
  };
}
