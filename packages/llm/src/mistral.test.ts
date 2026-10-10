import { describe, expect, it, vi } from "vitest";
import { InboundLlmOutputSchema } from "./index.js";
import { MistralLlmClient } from "./mistral.js";

describe("MistralLlmClient", () => {
  it("calls EU chat completions and parses structured JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "mistral-small-latest",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intent: "answer",
                  answer: { question_id: "matter_type", value: "corporate" },
                  assistant_message: "Merci.",
                  claimed_facts: [],
                }),
              },
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 34 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new MistralLlmClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.completeStructured({
      system: "sys",
      user: "user",
      schema: InboundLlmOutputSchema,
    });

    expect(result.data.intent).toBe("answer");
    expect(result.usage.provider).toBe("mistral");
    expect(result.usage.inputTokens).toBe(12);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.eu.mistral.ai/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
