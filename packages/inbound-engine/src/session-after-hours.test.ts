import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "@kanso/config";
import { createSession, startQualification } from "./session.js";
import { AFTER_HOURS_NOTICE } from "./business-hours.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const config = parseInboundConfig(
  JSON.parse(
    readFileSync(
      join(root, "config/examples/inbound.avocats.example.json"),
      "utf8",
    ),
  ),
);

describe("startQualification after hours (D-118)", () => {
  it("blocks on Sunday — ClosedDegraded + notice", () => {
    const session = createSession("s1", "t1", 1);
    const started = startQualification(session, config, {
      now: new Date("2026-10-11T14:00:00Z"),
    });
    expect(started.afterHours).toBe(true);
    expect(started.session.state).toBe("ClosedDegraded");
    expect(started.assistantMessage).toContain(AFTER_HOURS_NOTICE);
  });

  it("opens Qualify on weekday morning", () => {
    const session = createSession("s2", "t1", 1);
    const started = startQualification(session, config, {
      now: new Date("2026-10-12T10:00:00Z"),
    });
    expect(started.afterHours).toBe(false);
    expect(started.session.state).toBe("Qualify");
    expect(started.assistantMessage).not.toContain(AFTER_HOURS_NOTICE);
  });
});
