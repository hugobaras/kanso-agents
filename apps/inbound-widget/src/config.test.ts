import { describe, expect, it } from "vitest";
import { parseScriptConfig } from "./config.js";

describe("parseScriptConfig", () => {
  it("reads data attributes", () => {
    const script = document.createElement("script");
    script.dataset.tenant = "demo-tenant";
    script.dataset.api = "http://localhost:3000/";
    script.dataset.primaryColor = "#112233";
    script.dataset.title = "Demo";
    const cfg = parseScriptConfig(script);
    expect(cfg.tenantId).toBe("demo-tenant");
    expect(cfg.apiBase).toBe("http://localhost:3000");
    expect(cfg.primaryColor).toBe("#112233");
  });
});
