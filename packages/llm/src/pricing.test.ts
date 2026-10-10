import { describe, expect, it } from "vitest";
import { estimateUsageEur } from "./pricing.js";

describe("estimateUsageEur", () => {
  it("returns 0 for mock", () => {
    expect(
      estimateUsageEur({
        provider: "mock",
        modelId: "mock-deterministic",
        inputTokens: 1000,
        outputTokens: 1000,
      }),
    ).toBe(0);
  });

  it("estimates mistral small", () => {
    const eur = estimateUsageEur({
      provider: "mistral",
      modelId: "mistral-small-latest",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(eur).toBe(0.4);
  });
});
