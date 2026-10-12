import type { InboundConfig } from "@kanso/config";
import {
  AFTER_HOURS_QUALIFY_NOTICE,
  blocksAfterHours,
  isWithinBusinessHours,
  resolveAfterHoursMessage,
} from "./business-hours.js";
import { computeScore } from "./scoring.js";

export type InboundState =
  | "Greeting"
  | "Qualify"
  | "OffTopic"
  | "PolicyRefuse"
  | "CaptureContact"
  | "ScoreReady"
  | "Handoff"
  | "Alerting"
  | "Escalate"
  | "ClosedComplete"
  | "ClosedAbandoned"
  | "ClosedPolicy"
  | "ClosedDegraded";

export type InboundSession = {
  id: string;
  tenantId: string;
  configVersion: number;
  state: InboundState;
  answers: Record<string, unknown>;
  scoreCurrent: number;
  scoreFinal: number | null;
  messages: string[];
};

export function createSession(
  id: string,
  tenantId: string,
  configVersion: number,
): InboundSession {
  return {
    id,
    tenantId,
    configVersion,
    state: "Greeting",
    answers: {},
    scoreCurrent: 0,
    scoreFinal: null,
    messages: [],
  };
}

export function newSessionId(): string {
  return globalThis.crypto.randomUUID();
}

export function startQualification(
  session: InboundSession,
  config: InboundConfig,
  opts: { now?: Date } = {},
): {
  session: InboundSession;
  assistantMessage: string;
  afterHours: boolean;
} {
  const now = opts.now ?? new Date();
  const afterHours = blocksAfterHours(config, now);
  const notice = config.disclosure.ai_notice;

  if (afterHours) {
    const blocked = resolveAfterHoursMessage(config);
    const next = {
      ...session,
      state: "ClosedDegraded" as const,
      messages: [...session.messages, notice, blocked],
    };
    return {
      session: next,
      assistantMessage: [notice, blocked].join("\n\n"),
      afterHours: true,
    };
  }

  const next = {
    ...session,
    state: "Qualify" as const,
    messages: [...session.messages, notice],
  };
  const first = config.qualification.questions[0];
  const closedNote = isWithinBusinessHours(config, now)
    ? null
    : config.operations.after_hours_message?.trim() || AFTER_HOURS_QUALIFY_NOTICE;
  const assistantMessage = [
    config.identity.welcome_message,
    notice,
    closedNote,
    first?.prompt ?? "",
  ]
    .filter((m): m is string => !!m && m.trim().length > 0)
    .join("\n\n");
  return { session: next, assistantMessage, afterHours: false };
}

export function recordAnswer(
  session: InboundSession,
  config: InboundConfig,
  questionId: string,
  value: unknown,
): InboundSession {
  const question = config.qualification.questions.find((q) => q.id === questionId);
  if (!question) return session;
  const expected = nextRequiredQuestion(config, session.answers);
  // Allow contact capture outside strict required order when in CaptureContact
  if (
    session.state !== "CaptureContact" &&
    expected &&
    expected.id !== questionId
  ) {
    return session;
  }
  const answers = { ...session.answers, [questionId]: value };
  const scoreCurrent = computeScore(config, answers);
  return { ...session, answers, scoreCurrent };
}

export function nextRequiredQuestion(
  config: InboundConfig,
  answers: Record<string, unknown>,
) {
  return config.qualification.questions.find(
    (q) => q.required && answers[q.id] === undefined,
  );
}

export function maybeCompleteQualification(
  session: InboundSession,
  config: InboundConfig,
): InboundSession {
  if (nextRequiredQuestion(config, session.answers)) return session;
  return {
    ...session,
    state: "ScoreReady",
    scoreFinal: session.scoreCurrent,
  };
}

export function alertEventForScore(
  config: InboundConfig,
  scoreFinal: number,
): "hot_lead" | "handoff" {
  return scoreFinal >= config.scoring.thresholds.hot ? "hot_lead" : "handoff";
}

export function contactQuestion(config: InboundConfig) {
  return config.qualification.questions.find(
    (q) => q.id.includes("email") || q.id.includes("contact"),
  );
}
