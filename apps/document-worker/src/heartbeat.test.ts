import { describe, expect, it } from "vitest";
import { workerHeartbeat } from "./heartbeat.js";

describe("document-worker", () => {
  it("heartbeat ok", () => {
    expect(workerHeartbeat().ok).toBe(true);
  });
});
