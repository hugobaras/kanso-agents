import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "@kanso/config";
import { MockLlmClient } from "@kanso/llm";
import { createSession, startQualification } from "./session.js";

const WEEKDAY_MORNING = new Date("2026-10-12T10:00:00Z");
import { orchestrateTurn } from "./orchestrate.js";
import { validateInboundLlmAgainstConfig } from "./validate-llm.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const config = parseInboundConfig(
  JSON.parse(
    readFileSync(
      join(root, "config/examples/inbound.avocats.example.json"),
      "utf8",
    ),
  ),
);

describe("validateInboundLlmAgainstConfig", () => {
  it("rejects unknown question_id", () => {
    expect(() =>
      validateInboundLlmAgainstConfig(
        {
          intent: "answer",
          answer: { question_id: "not_real", value: "x" },
          assistant_message: "ok",
          claimed_facts: [],
        },
        config,
        "matter_type",
      ),
    ).toThrow(/not in config/);
  });

  it("sanitizes hallucination-like messages", () => {
    const v = validateInboundLlmAgainstConfig(
      {
        intent: "off_topic",
        answer: null,
        assistant_message: "Le tarif est de 500 €",
        claimed_facts: [],
      },
      config,
      "matter_type",
    );
    expect(v.sanitizedMessage).toMatch(/ne peux pas indiquer/);
  });
});

describe("orchestrateTurn", () => {
  it("records answer and asks next question", async () => {
    let session = createSession(
      "00000000-0000-4000-8000-000000000001",
      "cabinet-durand",
      1,
    );
    session = startQualification(session, config, { now: WEEKDAY_MORNING }).session;
    const llm = new MockLlmClient([
      {
        intent: "answer",
        answer: { question_id: "matter_type", value: "corporate" },
        assistant_message: "Merci.",
        claimed_facts: [],
      },
    ]);
    const turn = await orchestrateTurn({
      session,
      config,
      userText: "droit des sociétés",
      llm,
    });
    expect(turn.session.answers.matter_type).toBe("corporate");
    expect(turn.session.state).toBe("Qualify");
    expect(turn.assistantMessage).toMatch(/délai/);
  });

  it("refuses advice and moves to CaptureContact", async () => {
    let session = createSession(
      "00000000-0000-4000-8000-000000000002",
      "cabinet-durand",
      1,
    );
    session = startQualification(session, config, { now: WEEKDAY_MORNING }).session;
    const llm = new MockLlmClient([
      {
        intent: "advice",
        answer: null,
        assistant_message: "Voici mon analyse juridique...",
        claimed_facts: [],
      },
    ]);
    const turn = await orchestrateTurn({
      session,
      config,
      userText: "Ai-je une affaire ?",
      llm,
    });
    expect(turn.session.state).toBe("CaptureContact");
    expect(turn.assistantMessage).toMatch(/conseil juridique/);
  });
});
