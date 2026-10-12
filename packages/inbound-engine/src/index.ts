export {
  createSession,
  newSessionId,
  startQualification,
  recordAnswer,
  nextRequiredQuestion,
  maybeCompleteQualification,
  alertEventForScore,
  contactQuestion,
  type InboundSession,
  type InboundState,
} from "./session.js";
export {
  isWithinBusinessHours,
  AFTER_HOURS_NOTICE,
  resolveAfterHoursMessage,
} from "./business-hours.js";
export {
  InMemoryRagRetriever,
  formatRagContext,
  ragEnabled,
  type RagRetriever,
  type RagChunk,
  type RagHit,
} from "./rag.js";
export { computeScore } from "./scoring.js";
export {
  PostgresSessionStore,
  defaultSessionTtl,
  type SessionTtlConfig,
} from "./pg-sessions.js";
export { orchestrateTurn, type TurnResult } from "./orchestrate.js";
export { InboundHeuristicLlmClient } from "./heuristic-llm.js";
export {
  resolveExpectedQuestion,
  type ExpectedQuestionPayload,
} from "./expected-question.js";
export {
  buildHandoffTemplate,
  synthesizeHandoffMessage,
} from "./handoff.js";
export {
  parseInboundLlmOutput,
  validateInboundLlmAgainstConfig,
  buildInboundSystemPrompt,
} from "./validate-llm.js";

import type { InboundConfig } from "@kanso/config";
import type { AlertAdapter } from "@kanso/adapters";
import type { AuthContext } from "@kanso/tenancy";
import type { LlmClient } from "@kanso/llm";
import { MockAlertAdapter } from "@kanso/adapters";
import {
  createSession,
  startQualification,
  type InboundSession,
} from "./session.js";
import { orchestrateTurn } from "./orchestrate.js";

export type RunInboundE2EResult = {
  session: InboundSession;
  alertEvents: string[];
};

/**
 * Happy-path e2e using orchestrateTurn (mock LLM fixtures = one per user turn).
 */
export async function runInboundHappyPath(opts: {
  tenantId: string;
  config: InboundConfig;
  llm: LlmClient;
  alerts: AlertAdapter;
  auth: AuthContext;
  userTexts?: string[];
}): Promise<RunInboundE2EResult> {
  let session = createSession(
    "00000000-0000-4000-8000-0000000000e2",
    opts.tenantId,
    1,
  );
  const started = startQualification(session, opts.config);
  session = started.session;
  const alertEvents: string[] = [];
  const texts = opts.userTexts ?? ["corporate", "48h", "lead@example.com"];

  for (const userText of texts) {
    if (session.state.startsWith("Closed")) break;
    const turn = await orchestrateTurn({
      session,
      config: opts.config,
      userText,
      llm: opts.llm,
    });
    session = turn.session;
    if (turn.alertEvent) {
      alertEvents.push(turn.alertEvent);
      await opts.alerts.send(
        {
          channel: "email",
          event: turn.alertEvent,
          title: `Lead ${opts.tenantId}`,
          body: `score_final=${session.scoreFinal}`,
          metadata: { score: session.scoreFinal ?? 0 },
        },
        opts.auth,
        {
          tenantId: opts.tenantId,
          correlationId: session.id,
          configVersion: 1,
          attempt: 1,
        },
      );
    }
  }

  return { session, alertEvents };
}

/** Convenience for tests that don't care about alert adapter wiring. */
export async function runInboundHappyPathMockAlerts(
  opts: Omit<Parameters<typeof runInboundHappyPath>[0], "alerts" | "auth"> & {
    auth?: AuthContext;
  },
) {
  const alerts = new MockAlertAdapter();
  return runInboundHappyPath({
    ...opts,
    alerts,
    auth: opts.auth ?? {
      provider: "email",
      tenantId: opts.tenantId,
      credentials: { to: "ops@example.com" },
    },
  });
}
