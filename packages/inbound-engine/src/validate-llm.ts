import type { InboundConfig } from "@kanso/config";
import {
  InboundLlmOutputSchema,
  type InboundLlmOutput,
} from "@kanso/llm";
import { KansoError } from "@kanso/shared";

const HALLUCINATION_PATTERNS =
  /\b(\d+\s*€|euros?|tarif|prix|disponible demain|je vous rappelle sous|vous avez une affaire|conseil juridique\s*:)/i;

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

  let sanitizedMessage = output.assistant_message.trim();
  if (!sanitizedMessage) {
    throw new KansoError("empty assistant_message", "llm_empty_message");
  }
  if (HALLUCINATION_PATTERNS.test(sanitizedMessage) || output.claimed_facts.length > 0) {
    sanitizedMessage =
      "Je ne peux pas indiquer de prix, délais ou faits non présents dans la configuration. Continuons la qualification.";
  }

  return { ...output, sanitizedMessage };
}

export function buildInboundSystemPrompt(
  config: InboundConfig,
  expectedQuestionId: string | undefined,
  ragContext?: string,
): string {
  const questionIds = config.qualification.questions.map((q) => q.id).join(", ");
  const forbidden = config.disclosure.forbidden_topics.join(", ");
  const lines = [
    "Tu es un assistant de qualification. Tu n'es pas un humain.",
    `Disclaimer déjà affiché: ${config.disclosure.ai_notice}`,
    `Topics interdits (intent advice/forbidden): ${forbidden}`,
    "Ne donne jamais de conseil juridique ou comptable.",
    "N'affirme jamais de prix, délais de rappel, disponibilités ou faits hors configuration.",
    `question_id autorisés: ${questionIds}`,
    expectedQuestionId
      ? `Question attendue actuellement: ${expectedQuestionId}. Si l'utilisateur répond, intent=answer avec ce question_id.`
      : "Aucune question required restante.",
    "Réponds uniquement en JSON structuré conforme au schéma.",
  ];
  if (ragContext) {
    lines.push(ragContext);
  }
  return lines.join("\n");
}
