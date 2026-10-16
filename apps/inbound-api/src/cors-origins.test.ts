import { describe, expect, it, afterEach } from "vitest";
import { originMatches, resolveCorsOrigin } from "./cors-origins.js";

describe("resolveCorsOrigin", () => {
  afterEach(() => {
    delete process.env.KANSO_CORS_ORIGINS;
    delete process.env.KANSO_APP_URL;
    delete process.env.KANSO_PORTAIL_URL;
    delete process.env.KANSO_ENV;
  });

  it("never reflects unknown origins", () => {
    expect(resolveCorsOrigin("https://evil.example")).toBeUndefined();
  });

  it("allows the Portail domain", () => {
    process.env.KANSO_APP_URL = "https://app.kanso.fr";
    process.env.KANSO_PORTAIL_URL = "https://portail.kanso.fr";
    expect(resolveCorsOrigin("https://portail.kanso.fr")).toBe("https://portail.kanso.fr");
  });

  it("allows the app URL and listed origins", () => {
    process.env.KANSO_APP_URL = "https://app.kanso.fr";
    process.env.KANSO_CORS_ORIGINS = "https://admin.kanso.fr";
    expect(resolveCorsOrigin("https://app.kanso.fr")).toBe("https://app.kanso.fr");
    expect(resolveCorsOrigin("https://admin.kanso.fr")).toBe("https://admin.kanso.fr");
  });

  it("allows localhost only outside production", () => {
    expect(resolveCorsOrigin("http://localhost:5173")).toBe("http://localhost:5173");
    process.env.KANSO_ENV = "production";
    expect(resolveCorsOrigin("http://localhost:5173")).toBeUndefined();
  });
});

describe("originMatches", () => {
  it("matches exact and wildcard origins", () => {
    const allowed = ["https://www.cabinet.fr", "https://*.cabinet-durand.fr"];
    expect(originMatches("https://www.cabinet.fr", allowed)).toBe(true);
    expect(originMatches("https://www.cabinet.fr/", allowed)).toBe(true);
    expect(originMatches("https://blog.cabinet-durand.fr", allowed)).toBe(true);
    expect(originMatches("http://blog.cabinet-durand.fr", allowed)).toBe(false);
    expect(originMatches("https://cabinet.fr.evil.com", allowed)).toBe(false);
    expect(originMatches("https://evilcabinet-durand.fr", allowed)).toBe(false);
  });
});
