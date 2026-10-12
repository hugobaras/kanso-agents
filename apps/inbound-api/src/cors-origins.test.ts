import { describe, expect, it, afterEach } from "vitest";
import { resolveCorsOrigin } from "./cors-origins.js";

describe("resolveCorsOrigin", () => {
  afterEach(() => {
    delete process.env.KANSO_CORS_ORIGINS;
  });

  it("reflects origin when allowlist unset", () => {
    expect(resolveCorsOrigin("https://cabinet.fr")).toBe("https://cabinet.fr");
  });

  it("allows listed origin", () => {
    process.env.KANSO_CORS_ORIGINS = "https://cabinet.fr,https://www.cabinet.fr";
    expect(resolveCorsOrigin("https://cabinet.fr")).toBe("https://cabinet.fr");
  });

  it("rejects unknown origin when allowlist set", () => {
    process.env.KANSO_CORS_ORIGINS = "https://cabinet.fr";
    expect(resolveCorsOrigin("https://evil.example")).toBeUndefined();
  });
});
