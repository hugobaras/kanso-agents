import { KansoError } from "@kanso/shared";
import type { LlmClient, LlmStructuredRequest, LlmUsage } from "./types.js";

/** Deterministic mock for CI / default e2e. */
export class MockLlmClient implements LlmClient {
  constructor(private readonly fixtures: unknown[]) {}

  private index = 0;

  async completeStructured<T>(
    req: LlmStructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    const raw = this.fixtures[this.index];
    this.index += 1;
    if (raw === undefined) {
      throw new KansoError("No more LLM fixtures", "llm_mock_exhausted");
    }
    const data = req.schema.parse(raw);
    return {
      data,
      usage: {
        provider: "mock",
        modelId: "mock-deterministic",
        inputTokens: 10,
        outputTokens: 10,
      },
    };
  }
}
