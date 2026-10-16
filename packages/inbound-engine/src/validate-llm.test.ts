import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "@kanso/config";
import { NEUTRAL_ACK, stripMarkdown, validateInboundLlmAgainstConfig } from "./validate-llm.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const config = parseInboundConfig(
  JSON.parse(readFileSync(join(root, "config/examples/inbound.avocats.example.json"), "utf8")),
);

function validate(message: string) {
  return validateInboundLlmAgainstConfig(
    {
      intent: "answer",
      answer: { question_id: "urgency", value: "48h" },
      assistant_message: message,
      claimed_facts: [],
    },
    config,
    "urgency",
  );
}

describe("LLM output guards", () => {
  it("never lets the model promise a delay", () => {
    expect(validate("Votre demande sera traitée sous 48 heures.").sanitizedMessage).toBe(NEUTRAL_ACK);
    expect(validate("Un avocat vous rappellera dans la journée.").sanitizedMessage).toBe(NEUTRAL_ACK);
    expect(validate("Noté, vous souhaitez un échange sous 48 h.").sanitizedMessage).toBe(
      "Noté, vous souhaitez un échange sous 48 h.",
    );
  });

  it("strips markdown emphasis", () => {
    expect(stripMarkdown("Une affaire **urgente** ou `non` ?")).toBe("Une affaire urgente ou non ?");
    expect(stripMarkdown("## Titre\nTexte")).toBe("Titre\nTexte");
  });
});
