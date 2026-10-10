import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { readJobPayload, writeJobPayload } from "./storage.js";

describe("storage", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("roundtrips payload", () => {
    const dir = mkdtempSync(join(tmpdir(), "kanso-store-"));
    dirs.push(dir);
    process.env.KANSO_STORAGE_DIR = dir;
    const ref = writeJobPayload("t1", "job1", Buffer.from("hello"));
    expect(ref.startsWith("file://")).toBe(true);
    expect(readJobPayload(ref).toString()).toBe("hello");
  });
});
