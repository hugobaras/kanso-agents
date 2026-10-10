import { describe, expect, it } from "vitest";
import { softCapEurPerDay } from "./usage.js";

describe("softCapEurPerDay", () => {
  it("defaults to 5", () => {
    const prev = process.env.KANSO_SOFT_CAP_EUR_PER_DAY;
    delete process.env.KANSO_SOFT_CAP_EUR_PER_DAY;
    expect(softCapEurPerDay()).toBe(5);
    if (prev !== undefined) process.env.KANSO_SOFT_CAP_EUR_PER_DAY = prev;
  });

  it("reads env", () => {
    process.env.KANSO_SOFT_CAP_EUR_PER_DAY = "12.5";
    expect(softCapEurPerDay()).toBe(12.5);
    delete process.env.KANSO_SOFT_CAP_EUR_PER_DAY;
  });
});
