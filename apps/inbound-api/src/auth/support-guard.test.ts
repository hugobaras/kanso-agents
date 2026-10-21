import { describe, expect, it } from "vitest";
import { supportForbidden } from "./middleware.js";

describe("supportForbidden", () => {
  it("never serves file contents or exports", () => {
    for (const p of ["/portail/dossiers/d/files/f", "/portail/dossiers/d/export", "/documents/x/file", "/leads/export.csv", "/settings/privacy/export/1"]) {
      expect(supportForbidden("GET", p), p).toBe(true);
    }
  });

  it("keeps Portail dossiers out of reach, settings readable", () => {
    expect(supportForbidden("GET", "/portail/dossiers/d")).toBe(true);
    expect(supportForbidden("POST", "/portail/dossiers")).toBe(true);
    expect(supportForbidden("PUT", "/portail/settings")).toBe(true);
    expect(supportForbidden("GET", "/portail")).toBe(false);
    expect(supportForbidden("GET", "/portail/settings")).toBe(false);
  });

  it("blocks billing, team and privacy actions but allows configuration help", () => {
    expect(supportForbidden("POST", "/billing/checkout")).toBe(true);
    expect(supportForbidden("POST", "/team/invitations")).toBe(true);
    expect(supportForbidden("POST", "/settings/delete")).toBe(true);
    expect(supportForbidden("PUT", "/assistant/draft")).toBe(false);
    expect(supportForbidden("GET", "/leads/123")).toBe(false);
    expect(supportForbidden("GET", "/billing")).toBe(false);
  });
});
