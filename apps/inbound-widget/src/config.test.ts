import { describe, expect, it } from "vitest";
import { contrast, normaliseHex, onColor, readableOnWhite } from "./color.js";
import { parseScriptConfig } from "./config.js";
import { pickLocale } from "./i18n.js";

describe("parseScriptConfig", () => {
  it("reads the publishable key and defaults the API to the script origin", () => {
    const script = document.createElement("script");
    script.src = "https://api.kanso.fr/widget/kanso-widget.js";
    script.dataset.key = "pk_live_abcdefghijklmnop";
    const cfg = parseScriptConfig(script);
    expect(cfg.key).toBe("pk_live_abcdefghijklmnop");
    expect(cfg.apiBase).toBe("https://api.kanso.fr");
    expect(cfg.open).toBe(false);
  });

  it("keeps the legacy tenant mode", () => {
    const script = document.createElement("script");
    script.dataset.tenant = "demo-tenant";
    script.dataset.api = "http://localhost:3000/";
    const cfg = parseScriptConfig(script);
    expect(cfg.tenantId).toBe("demo-tenant");
    expect(cfg.apiBase).toBe("http://localhost:3000");
  });

  it("requires a key", () => {
    expect(() => parseScriptConfig(document.createElement("script"))).toThrow(/data-key/);
  });
});

describe("colour contrast", () => {
  it("uses white text on dark colours and ink on light ones", () => {
    expect(onColor("#1B2A4A")).toBe("#FFFFFF");
    expect(onColor("#F5D76E")).toBe("#1B2A4A");
  });
  it("darkens light accents until they are readable on white", () => {
    const c = readableOnWhite("#F5D76E");
    expect(contrast(c, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("normalises invalid colours", () => {
    expect(normaliseHex("red")).toBe("#1B2A4A");
    expect(normaliseHex("1f6f6b")).toBe("#1F6F6B");
  });
});

describe("locale", () => {
  it("prefers config, then browser", () => {
    expect(pickLocale("en", "fr-FR")).toBe("en");
    expect(pickLocale(undefined, "en-GB")).toBe("en");
    expect(pickLocale(undefined, "de-DE")).toBe("fr");
  });
});
