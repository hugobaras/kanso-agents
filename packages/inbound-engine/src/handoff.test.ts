import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "@kanso/config";
import { MockLlmClient } from "@kanso/llm";
import { createSession } from "./session.js";
import { buildHandoffTemplate, synthesizeHandoffMessage } from "./handoff.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const config = parseInboundConfig(
  JSON.parse(
    readFileSync(
      join(root, "config/examples/inbound.avocats.example.json"),
      "utf8",
    ),
  ),
);

describe("handoff", () => {
  it("builds template with answer labels", () => {
    const session = {
      ...createSession("00000000-0000-4000-8000-0000000000aa", "t", 1),
      answers: { matter_type: "labor", urgency: "week", contact_email: "a@b.co" },
      scoreFinal: 55,
    };
    const msg = buildHandoffTemplate(config, session);
    expect(msg).toMatch(/Droit social/);
    expect(msg).toMatch(/Sous 7 jours/);
    // The internal score is never shown to the visitor.
    expect(msg).not.toMatch(/55/);
    expect(msg).toMatch(/sans engagement/);
  });

  it("uses LLM when valid, else template", async () => {
    const session = {
      ...createSession("00000000-0000-4000-8000-0000000000ab", "t", 1),
      answers: { matter_type: "corporate" },
      scoreFinal: 40,
    };
    const llm = new MockLlmClient([
      {
        assistant_message:
          "Merci, votre demande a bien été transmise à l'équipe du Cabinet Durand.",
        claimed_facts: [],
      },
    ]);
    process.env.KANSO_LLM_HANDOFF = "1";
    const ok = await synthesizeHandoffMessage({ llm, config, session });
    expect(ok.source).toBe("llm");
    expect(ok.message).toMatch(/transmise/);

    const empty = new MockLlmClient([]);
    const fallback = await synthesizeHandoffMessage({
      llm: empty,
      config,
      session,
    });
    expect(fallback.source).toBe("template");
  });
});
