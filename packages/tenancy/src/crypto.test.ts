import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "./crypto.js";

describe("secret crypto", () => {
  it("roundtrips credentials", () => {
    const key = "test-master-key-32-chars-minimum!";
    const creds = { apiKey: "secret-value", webhook: "https://example.invalid" };
    const blob = encryptJson(key, creds);
    expect(decryptJson<typeof creds>(key, blob)).toEqual(creds);
  });
});
