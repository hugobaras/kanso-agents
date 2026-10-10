import { describe, expect, it } from "vitest";
import { processOnceMock } from "./process-once.js";

describe("processOnceMock", () => {
  it("runs extract→validate→draft", async () => {
    const result = await processOnceMock();
    expect(result.job.step).toBe("done");
    expect(result.drafts).toBe(1);
  });
});
