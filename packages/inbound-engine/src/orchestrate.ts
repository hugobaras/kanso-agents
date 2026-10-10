import type { InboundConfig } from "@kanso/config";
import {
  InboundLlmOutputSchema,
  type LlmClient,
  type InboundLlmOutput,
} from "@kanso/llm";
import { KansoError } from "@kanso/shared";
import {
  alertEventForScore,
  contactQuestion,
  maybeCompleteQualification,
  nextRequiredQuestion,
  recordAnswer,
  type InboundSession,
  type InboundState,
} from "./session.js";
import {
  formatRagContext,
  type RagRetriever,
} from "./rag.js";
import {
  buildInboundSystemPrompt,
  parseInboundLlmOutput,
  validateInboundLlmAgainstConfig,
} from "./validate-llm.js";

export type TurnResult = {
  session: InboundSession;
  assistantMessage: string;
  intent: InboundLlmOutput["intent"];
  alertEvent?: "hot_lead" | "handoff" | "escalation" | "new_lead";
};

const FALLBACK_MESSAGE =
  "Je n'ai pas bien compris. Pouvez-vous reformuler brièvement ?";

async function callLlmValidated(
  llm: LlmClient,
  config: InboundConfig,
  userText: string,
  expectedQuestionId: string | undefined,
  ragContext?: string,
): Promise<ReturnType<typeof validateInboundLlmAgainstConfig>> {
  const system = buildInboundSystemPrompt(
    config,
    expectedQuestionId,
    ragContext,
  );
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data } = await llm.completeStructured({
        system: attempt === 1 ? system : `${system}\nCorrection: respecte strictement le schéma et question_id.`,
        user: userText,
        schema: InboundLlmOutputSchema,
      });
      const parsed = parseInboundLlmOutput(data);
      return validateInboundLlmAgainstConfig(parsed, config, expectedQuestionId);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new KansoError("LLM validation failed", "llm_validation_failed");
}

function withState(session: InboundSession, state: InboundState): InboundSession {
  return { ...session, state };
}

function appendMessages(
  session: InboundSession,
  ...msgs: string[]
): InboundSession {
  return { ...session, messages: [...session.messages, ...msgs] };
}

/**
 * One user turn. Code owns state transitions; LLM only proposes intent + wording.
 */
export async function orchestrateTurn(opts: {
  session: InboundSession;
  config: InboundConfig;
  userText: string;
  llm: LlmClient;
  /** Opt-in RAG (P3-01). */
  rag?: RagRetriever;
}): Promise<TurnResult> {
  let session = opts.session;
  const text = opts.userText.trim();
  if (!text) {
    return {
      session,
      assistantMessage: FALLBACK_MESSAGE,
      intent: "other",
    };
  }

  if (
    session.state.startsWith("Closed") ||
    session.state === "Alerting" ||
    session.state === "Handoff" ||
    session.state === "ScoreReady"
  ) {
    // Allow completing ScoreReady → handoff in same path below via empty qualify
  }

  if (
    session.state === "ClosedComplete" ||
    session.state === "ClosedAbandoned" ||
    session.state === "ClosedPolicy" ||
    session.state === "ClosedDegraded"
  ) {
    return {
      session,
      assistantMessage: "Cette conversation est terminée. Rechargez le widget pour en démarrer une nouvelle.",
      intent: "bye",
    };
  }

  const contactQ = contactQuestion(opts.config);
  const expected =
    session.state === "CaptureContact" && contactQ
      ? contactQ
      : nextRequiredQuestion(opts.config, session.answers);

  let ragContext: string | undefined;
  if (opts.rag) {
    const hits = await opts.rag.retrieve({
      tenantId: session.tenantId,
      query: text,
    });
    ragContext = formatRagContext(hits);
  }

  let validated: ReturnType<typeof validateInboundLlmAgainstConfig>;
  try {
    validated = await callLlmValidated(
      opts.llm,
      opts.config,
      text,
      expected?.id,
      ragContext,
    );
  } catch {
    const prompt = expected?.prompt ?? "Comment puis-je vous aider ?";
    return {
      session: appendMessages(session, text, FALLBACK_MESSAGE),
      assistantMessage: `${FALLBACK_MESSAGE}\n\n${prompt}`,
      intent: "other",
    };
  }

  session = appendMessages(session, text);

  switch (validated.intent) {
    case "bye": {
      session = withState(session, "ClosedAbandoned");
      return {
        session: appendMessages(session, validated.sanitizedMessage),
        assistantMessage: validated.sanitizedMessage,
        intent: "bye",
      };
    }
    case "human": {
      session = withState(session, "Escalate");
      const msg =
        opts.config.operations.escalation.message || validated.sanitizedMessage;
      session = withState(appendMessages(session, msg), "Alerting");
      session = withState(session, "ClosedComplete");
      return {
        session,
        assistantMessage: msg,
        intent: "human",
        alertEvent: "escalation",
      };
    }
    case "advice":
    case "forbidden": {
      session = withState(session, "PolicyRefuse");
      const refuse =
        "Je ne peux pas fournir de conseil juridique ou comptable. Je peux transmettre vos coordonnées à l'équipe.";
      if (contactQ && session.answers[contactQ.id] === undefined) {
        session = withState(session, "CaptureContact");
        const msg = `${refuse}\n\n${contactQ.prompt}`;
        return {
          session: appendMessages(session, msg),
          assistantMessage: msg,
          intent: validated.intent,
        };
      }
      session = withState(session, "ClosedPolicy");
      return {
        session: appendMessages(session, refuse),
        assistantMessage: refuse,
        intent: validated.intent,
      };
    }
    case "insist": {
      if (
        session.state === "PolicyRefuse" ||
        session.state === "CaptureContact" ||
        session.state === "OffTopic"
      ) {
        const msg = opts.config.operations.escalation.message;
        session = withState(appendMessages(session, msg), "ClosedComplete");
        return {
          session,
          assistantMessage: msg,
          intent: "insist",
          alertEvent: "escalation",
        };
      }
      break;
    }
    case "off_topic": {
      session = withState(session, "OffTopic");
      const redirect = expected
        ? `${validated.sanitizedMessage}\n\n${expected.prompt}`
        : validated.sanitizedMessage;
      session = withState(appendMessages(session, redirect), "Qualify");
      return {
        session,
        assistantMessage: redirect,
        intent: "off_topic",
      };
    }
    case "answer": {
      if (!validated.answer) break;
      session = recordAnswer(
        session,
        opts.config,
        validated.answer.question_id,
        validated.answer.value,
      );

      if (session.state === "CaptureContact") {
        const thanks =
          "Merci. Vos coordonnées sont transmises. Un collaborateur pourra vous recontacter.";
        session = withState(appendMessages(session, thanks), "ClosedPolicy");
        return {
          session,
          assistantMessage: thanks,
          intent: "answer",
          alertEvent: "new_lead",
        };
      }

      session = maybeCompleteQualification(session, opts.config);

      if (session.state === "ScoreReady") {
        const handoff =
          "Merci. J'ai transmis votre demande à l'équipe. Un collaborateur vous recontactera selon leurs disponibilités (sans engagement de délai).";
        session = withState(session, "Handoff");
        session = withState(appendMessages(session, handoff), "Alerting");
        const event = alertEventForScore(opts.config, session.scoreFinal ?? 0);
        session = withState(session, "ClosedComplete");
        return {
          session,
          assistantMessage: handoff,
          intent: "answer",
          alertEvent: event,
        };
      }

      const next = nextRequiredQuestion(opts.config, session.answers);
      const msg = next
        ? `${validated.sanitizedMessage}\n\n${next.prompt}`
        : validated.sanitizedMessage;
      session = withState(appendMessages(session, msg), "Qualify");
      return {
        session,
        assistantMessage: msg,
        intent: "answer",
      };
    }
    default:
      break;
  }

  const prompt = expected?.prompt ?? "";
  const msg = prompt
    ? `${validated.sanitizedMessage}\n\n${prompt}`
    : validated.sanitizedMessage;
  session = withState(appendMessages(session, msg), "Qualify");
  return { session, assistantMessage: msg, intent: validated.intent };
}
