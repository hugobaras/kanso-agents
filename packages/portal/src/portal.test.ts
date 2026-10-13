import { describe, expect, it } from "vitest";
import * as c from "./crypto.js";
import { SYSTEM_TEMPLATES, templatesFor } from "./templates.js";
import { computeStage, isComplete, stageLabels } from "./stages.js";
import { sniffPortalMime } from "./file-type.js";

describe("templates", () => {
  it("has unique keys and filters by profession", () => {
    const keys = SYSTEM_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(templatesFor("notaire").some((t) => t.key === "no-succession")).toBe(true);
    expect(templatesFor("notaire").some((t) => t.key === "ec-bilan")).toBe(false);
    expect(templatesFor("notaire").some((t) => t.key === "libre")).toBe(true);
  });
});

describe("stages", () => {
  const it1 = (status: any, hasFile: boolean, required = true) => ({ required, status, hasFile });
  it("computes stage from items", () => {
    expect(computeStage("a_completer", [it1("pending", false)])).toBe("a_completer");
    expect(computeStage("a_completer", [it1("received", true), it1("pending", false, false)])).toBe("en_verification");
    expect(computeStage("a_completer", [it1("accepted", true)])).toBe("complet");
    expect(computeStage("termine", [it1("pending", false)])).toBe("termine");
    expect(computeStage("en_verification", [it1("refused", true)])).toBe("a_completer");
    expect(isComplete([])).toBe(false);
  });
  it("labels fall back to defaults", () => {
    expect(stageLabels({ complet: " Prêt " }).complet).toBe("Prêt");
    expect(stageLabels(null).termine).toBe("Terminé");
  });
});

describe("file type", () => {
  it("sniffs pdf and rejects others", () => {
    expect(sniffPortalMime(Buffer.from("%PDF-1.7 abc"))).toBe("application/pdf");
    expect(sniffPortalMime(Buffer.from("MZ\x90\x00"))).toBeNull();
  });
});

describe("crypto", () => {
  const kek = c.tenantKek("master-key-for-tests", "cab-a");
  const aad = c.fileAad("cab-a", "d1", "f1");
  it("roundtrips and never stores plaintext", () => {
    const data = Buffer.from("contenu confidentiel");
    const { blob, wrappedKey } = c.encryptFile(kek, data, aad);
    expect(blob.includes(data)).toBe(false);
    expect(c.decryptFile(kek, blob, wrappedKey, aad).equals(data)).toBe(true);
  });
  it("rejects tampering, other tenant and other file", () => {
    const { blob, wrappedKey } = c.encryptFile(kek, Buffer.from("x".repeat(100)), aad);
    const bad = Buffer.from(blob);
    bad[20] ^= 1;
    expect(() => c.decryptFile(kek, bad, wrappedKey, aad)).toThrow();
    expect(() => c.decryptFile(c.tenantKek("master-key-for-tests", "cab-b"), blob, wrappedKey, aad)).toThrow();
    expect(() => c.decryptFile(kek, blob, wrappedKey, c.fileAad("cab-a", "d1", "f2"))).toThrow();
  });
  it("codes are 6 digits and bound to the contact", () => {
    expect(c.newLoginCode()).toMatch(/^\d{6}$/);
    expect(c.hashCode("a", "123456")).not.toBe(c.hashCode("b", "123456"));
    expect(c.newLinkToken().length).toBeGreaterThanOrEqual(43);
  });
});
