import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "@kanso/config";
import { InboundLlmOutputSchema } from "@kanso/llm";
import { InboundHeuristicLlmClient } from "./heuristic-llm.js";
import { buildInboundSystemPrompt } from "./validate-llm.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const config = parseInboundConfig(
  JSON.parse(
    readFileSync(
      join(root, "config/examples/inbound.avocats.example.json"),
      "utf8",
    ),
  ),
);

async function ask(questionId: string, user: string) {
  const llm = new InboundHeuristicLlmClient(config);
  const system = buildInboundSystemPrompt(config, questionId);
  const { data } = await llm.completeStructured({
    system,
    user,
    schema: InboundLlmOutputSchema,
  });
  return data;
}

describe("InboundHeuristicLlmClient (flexible)", () => {
  it("maps free-form labor phrases", async () => {
    for (const u of [
      "droit du travail",
      "mon employeur me licencie",
      " litige prud'hommes ",
    ]) {
      const data = await ask("matter_type", u);
      expect(data.intent).toBe("answer");
      expect(data.answer?.value).toBe("labor");
    }
  });

  it("maps free-form urgency phrases to buckets", async () => {
    expect((await ask("urgency", "c'est urgent")).answer?.value).toBe("48h");
    expect((await ask("urgency", "d'ici jeudi")).answer?.value).toBe("week");
    expect((await ask("urgency", "pour jeudi")).answer?.value).toBe("week");
    expect((await ask("urgency", "dans 5 jours")).answer?.value).toBe("week");
    expect((await ask("urgency", "pas pressé")).answer?.value).toBe("flex");
    expect((await ask("urgency", "vers mi-novembre")).answer?.value).toBe(
      "week",
    );
  });

  it("soft-accepts vague urgency instead of looping", async () => {
    const data = await ask("urgency", "dès que ça arrange le cabinet");
    expect(data.intent).toBe("answer");
    expect(["week", "flex", "48h"]).toContain(data.answer?.value);
  });

  it("maps unknown matter to other", async () => {
    const data = await ask("matter_type", "quelque chose d'assez vague");
    expect(data.intent).toBe("answer");
    expect(data.answer?.value).toBe("other");
  });
});
