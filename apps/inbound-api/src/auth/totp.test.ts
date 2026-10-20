import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  currentStep,
  decryptSecret,
  encryptSecret,
  hashRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  totpAt,
  verifyTotp,
} from "./totp.js";

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 appendix B, SHA-1 seed; the 8-digit vectors end with these 6 digits.
  const seed = Buffer.from("12345678901234567890");
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("t=%i -> %s", (t, want) => {
    expect(totpAt(seed, Math.floor(t / 30))).toBe(want);
  });

  it("round-trips base32", () => {
    const b = Buffer.from("12345678901234567890");
    expect(base32Encode(b)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });

  it("accepts the current code once, refuses replays, wrong codes and stale steps", () => {
    const secret = newTotpSecret();
    const now = Date.UTC(2026, 9, 20, 12, 0, 0);
    const code = totpAt(base32Decode(secret), currentStep(now));
    const step = verifyTotp(secret, code, null, now);
    expect(step).toBe(currentStep(now));
    expect(verifyTotp(secret, code, step, now)).toBeNull();
    expect(verifyTotp(secret, "000000", null, now) === null || code === "000000").toBe(true);
    expect(verifyTotp(secret, code, null, now + 5 * 60_000)).toBeNull();
    expect(verifyTotp(secret, "12a456", null, now)).toBeNull();
  });

  it("encrypts the secret, bound to its user", () => {
    const enc = encryptSecret("master-key-for-tests-only-32-chars!!", "JBSWY3DPEHPK3PXP", "user-1");
    expect(enc).not.toContain("JBSWY3DP");
    expect(decryptSecret("master-key-for-tests-only-32-chars!!", enc, "user-1")).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret("master-key-for-tests-only-32-chars!!", enc, "user-2")).toThrow();
  });

  it("issues distinct recovery codes, hashed independently of formatting", () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
    expect(hashRecoveryCode(codes[0]!.toUpperCase().replace("-", " "))).toBe(hashRecoveryCode(codes[0]!));
  });
});
