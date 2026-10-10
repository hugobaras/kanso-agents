import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "@kanso/config";
import { isWithinBusinessHours } from "./business-hours.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const config = parseInboundConfig(
  JSON.parse(
    readFileSync(
      join(root, "config/examples/inbound.avocats.example.json"),
      "utf8",
    ),
  ),
);

describe("isWithinBusinessHours", () => {
  it("true on weekday morning Paris", () => {
    // 2026-10-12 = Monday 10:00 UTC = 12:00 Paris (CEST)
    expect(isWithinBusinessHours(config, new Date("2026-10-12T10:00:00Z"))).toBe(
      true,
    );
  });

  it("false on Sunday", () => {
    expect(isWithinBusinessHours(config, new Date("2026-10-11T10:00:00Z"))).toBe(
      false,
    );
  });
});
