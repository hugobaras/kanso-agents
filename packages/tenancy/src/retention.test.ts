import { describe, expect, it } from "vitest";
import { RETENTION_DAYS } from "./retention.js";

describe("RETENTION_DAYS", () => {
  it("matches phase-6 90/90/365/30", () => {
    expect(RETENTION_DAYS.inboundSessions).toBe(90);
    expect(RETENTION_DAYS.documentJobs).toBe(90);
    expect(RETENTION_DAYS.auditEvents).toBe(365);
    expect(RETENTION_DAYS.usageLedger).toBe(365);
    expect(RETENTION_DAYS.adapterDeadLetters).toBe(90);
    expect(RETENTION_DAYS.appLogs).toBe(30);
  });
});
