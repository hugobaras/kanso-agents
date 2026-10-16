import type { InboundConfig } from "@kanso/config";
import {
  InboundLlmOutputSchema,
  type InboundLlmOutput,
} from "@kanso/llm";
import { KansoError } from "@kanso/shared";
import type { ExpectedQuestionPayload } from "./expected-question.js";

const HALLUCINATION_PATTERNS =
  /\b(\d+\s*€|euros?|tarif|prix|disponible demain|je vous rappelle sous|vous avez une affaire|conseil juridique\s*:)/i;

/** Commitments on delays / outcomes the firm never made (obligation de moyens). */
const PROMISE_PATTERNS =
  /\b(sera (trait|étudi|pris|examin)\w*|(vous )?(rappelle|recontact|répond)\w* (sous|dans|d'ici|avant|rapidement|très vite)|(nous|on|l'équipe|le cabinet) (allons|va|vont) (vous )?(rappeler|recontacter|traiter)|garanti\w*|sans faute|dès aujourd'hui)/i;

export const NEUTRAL_ACK = "C'est noté.";

export function containsUnsafeClaim(text: string): boolean {
  return HALLUCINATION_PATTERNS.test(text) || PROMISE_PATTERNS.test(text);
}

export type ValidatedInboundLlm = InboundLlmOutput & {
  sanitizedMessage: string;
};

export function parseInboundLlmOutput(raw: unknown): InboundLlmOutput {
  return InboundLlmOutputSchema.parse(raw);
}

/**
 * Code-side guards (phase 3 A/B/C): schema already parsed; enforce question allowlist
 * and strip unsafe affirmations.
 */
export function validateInboundLlmAgainstConfig(
  output: InboundLlmOutput,
  config: InboundConfig,
  expectedQuestionId: string | undefined,
): ValidatedInboundLlm {
  if (output.intent === "answer") {
    if (!output.answer) {
      throw new KansoError("answer intent without answer payload", "llm_answer_missing");
    }
    const allowed = new Set(config.qualification.questions.map((q) => q.id));
    if (!allowed.has(output.answer.question_id)) {
      throw new KansoError(
        `question_id not in config: ${output.answer.question_id}`,
        "llm_question_not_allowed",
      );
    }
    if (expectedQuestionId && output.answer.question_id !== expectedQuestionId) {
      throw new KansoError(
        `expected ${expectedQuestionId}, got ${output.answer.question_id}`,
        "llm_wrong_question",
      );
    }
  }

  let sanitizedMessage = stripMarkdown(output.assistant_message);
  if (!sanitizedMessage) {
    throw new KansoError("empty assistant_message", "llm_empty_message");
  }
  // claimed_facts alone must not wipe a valid ack — only strip unsafe prose.
  if (HALLUCINATION_PATTERNS.test(sanitizedMessage)) {
    sanitizedMessage =
      "Je ne peux pas indiquer de prix, délais ou faits non présents dans la configuration. Continuons la qualification.";
  } else if (PROMISE_PATTERNS.test(sanitizedMessage)) {
    sanitizedMessage = NEUTRAL_ACK;
  } else if (output.claimed_facts.length > 0) {
    // Soft: keep wording, drop facts (code owns truth).
    sanitizedMessage = sanitizedMessage;
  }

  return {
    ...output,
    claimed_facts: [],
    sanitizedMessage,
  };
}

/** Widgets render plain text: drop markdown emphasis/headings the model may add. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|\s)\*(\S.*?)\*(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

export function buildInboundSystemPrompt(
  config: InboundConfig,
  expectedQuestionId: string | undefined,
  ragContext?: string,
  opts?: {
    expected?: ExpectedQuestionPayload | null;
    recentMessages?: string[];
    answers?: Record<string, unknown>;
  },
): string {
  const questionIds = config.qualification.questions.map((q) => q.id).join(", ");
  const forbidden = config.disclosure.forbidden_topics.join(", ");
  const expected = opts?.expected;
  const lines = [
    "Tu es un assistant de qualification conversationnel. Tu n'es pas un humain.",
    `Disclaimer déjà affiché: ${config.disclosure.ai_notice}`,
    `Topics interdits (intent advice/forbidden): ${forbidden}`,
    "Ne donne jamais de conseil juridique ou comptable.",
    "N'affirme jamais de prix, délais de rappel, disponibilités ou faits hors configuration.",
    "Ne promets jamais de délai de traitement ni de rappel : si le visiteur indique un délai, reformule son souhait (« Noté, vous souhaitez un échange sous 48 h. »).",
    "Ton: naturel, concis, professionnel — évite les réponses d'un mot seules (« Merci. ») ; reformule brièvement.",
    "assistant_message : UNE phrase d'accusé de réception (30 mots maximum). Ne pose AUCUNE question : le système ajoute lui-même la question suivante.",
    "Texte brut uniquement : pas de markdown, pas de gras, pas de liste.",
    `question_id autorisés: ${questionIds}`,
  ];

  if (expected) {
    lines.push(
      `Question attendue actuellement: ${expected.id} — « ${expected.prompt} »`,
    );
    if (expected.options?.length) {
      lines.push(
        "Options autorisées pour answer.value (utiliser l'id) :",
        ...expected.options.map((o) => `- ${o.id}: ${o.label}`),
      );
      lines.push(
        "Mappe le langage naturel vers l'id d'option le plus proche (ex. « d'ici jeudi » → week si présent).",
      );
    }
    lines.push(
      `Si l'utilisateur répond à cette question, intent=answer avec question_id=${expected.id}.`,
    );
  } else if (expectedQuestionId) {
    lines.push(
      `Question attendue actuellement: ${expectedQuestionId}. Si l'utilisateur répond, intent=answer avec ce question_id.`,
    );
  } else {
    lines.push("Aucune question required restante.");
  }

  if (opts?.answers && Object.keys(opts.answers).length > 0) {
    lines.push(`Réponses déjà collectées: ${JSON.stringify(opts.answers)}`);
  }

  const recent = opts?.recentMessages?.filter(Boolean).slice(-12) ?? [];
  if (recent.length) {
    lines.push("Historique récent de la conversation (du plus ancien au plus récent) :");
    for (const m of recent) {
      lines.push(`- ${m.slice(0, 400)}`);
    }
  }

  lines.push("Réponds uniquement en JSON structuré conforme au schéma.");
  if (ragContext) {
    lines.push(ragContext);
  }
  return lines.join("\n");
}
