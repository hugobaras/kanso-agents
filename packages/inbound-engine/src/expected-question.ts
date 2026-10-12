import type { InboundConfig } from "@kanso/config";
import {
  contactQuestion,
  nextRequiredQuestion,
  type InboundSession,
} from "./session.js";

export type ExpectedQuestionPayload = {
  id: string;
  prompt: string;
  type: string;
  options: Array<{ id: string; label: string }> | null;
};

/** Question the UI/LLM should treat as current (chips + prompt context). */
export function resolveExpectedQuestion(
  config: InboundConfig,
  session: InboundSession,
): ExpectedQuestionPayload | null {
  if (session.state.startsWith("Closed")) return null;

  const contactQ = contactQuestion(config);
  const q =
    session.state === "CaptureContact" && contactQ
      ? contactQ
      : nextRequiredQuestion(config, session.answers);

  if (!q) return null;

  return {
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    options:
      q.options?.map((o) => ({ id: o.id, label: o.label })) ?? null,
  };
}
