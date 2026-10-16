import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "@kanso/config";
import { MockLlmClient } from "@kanso/llm";
import { MockAlertAdapter } from "@kanso/adapters";
import { runInboundHappyPath } from "./index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("inbound e2e mock", () => {
  it("qualifies, freezes score, sends alert", async () => {
    const config = parseInboundConfig(
      JSON.parse(
        readFileSync(
          join(root, "config/examples/inbound.avocats.example.json"),
          "utf8",
        ),
      ),
    );
    const llm = new MockLlmClient([
      {
        intent: "answer",
        answer: { question_id: "matter_type", value: "corporate" },
        assistant_message: "Merci.",
        claimed_facts: [],
      },
      {
        intent: "answer",
        answer: { question_id: "urgency", value: "48h" },
        assistant_message: "Noté.",
        claimed_facts: [],
      },
      {
        intent: "answer",
        answer: { question_id: "contact_email", value: "lead@example.com" },
        assistant_message: "Merci, je transmets.",
        claimed_facts: [],
      },
    ]);
    const alerts = new MockAlertAdapter();
    const result = await runInboundHappyPath({
      tenantId: "cabinet-durand",
      config,
      llm,
      alerts,
      now: new Date("2026-10-12T10:00:00Z"),
      auth: {
        provider: "email",
        tenantId: "cabinet-durand",
        credentials: { to: "ops@example.com" },
      },
    });

    expect(result.session.state).toBe("ClosedComplete");
    expect(result.session.scoreFinal).toBe(75);
    expect(result.alertEvents[0]).toBe("hot_lead");
    expect(alerts.sent).toHaveLength(1);
  });
});
