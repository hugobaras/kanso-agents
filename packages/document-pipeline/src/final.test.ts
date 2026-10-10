import { describe, expect, it } from "vitest";
import { finalModeAllowed } from "./pipeline.js";

describe("finalModeAllowed", () => {
  it("false by default", () => {
    const prev = process.env.KANSO_ALLOW_FINAL;
    delete process.env.KANSO_ALLOW_FINAL;
    expect(finalModeAllowed()).toBe(false);
    if (prev !== undefined) process.env.KANSO_ALLOW_FINAL = prev;
  });

  it("true when env set", () => {
    process.env.KANSO_ALLOW_FINAL = "1";
    expect(finalModeAllowed()).toBe(true);
    delete process.env.KANSO_ALLOW_FINAL;
  });
});
