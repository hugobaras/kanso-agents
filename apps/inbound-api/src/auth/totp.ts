import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/** Double authentification par code à usage unique (TOTP, RFC 6238 : SHA-1, 30 s, 6 chiffres). */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secret: Buffer, step: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  const bin = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const currentStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/**
 * Accepts the current code and its immediate neighbours (clock drift).
 * Returns the matched step, or null; a step at or below lastStep is a replay and refused.
 */
export function verifyTotp(secretB32: string, code: string, lastStep: number | null, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const now = currentStep(nowMs);
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const want = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(want, Buffer.from(code))) return step;
  }
  return null;
}

export function otpauthUrl(secretB32: string, account: string, issuer = "Kanso"): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// ---- Stockage chiffré du secret (clé dérivée de KANSO_MASTER_KEY) ----
function key(masterKey: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(masterKey, "utf8"), Buffer.from("kanso-totp:v1"), Buffer.from("users"), 32));
}

export function encryptSecret(masterKey: string, secretB32: string, userId: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(masterKey), iv);
  c.setAAD(Buffer.from(userId));
  const enc = Buffer.concat([c.update(secretB32, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(masterKey: string, stored: string, userId: string): string {
  const raw = Buffer.from(stored, "base64");
  const d = createDecipheriv("aes-256-gcm", key(masterKey), raw.subarray(0, 12));
  d.setAAD(Buffer.from(userId));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

// ---- Codes de secours (à usage unique, stockés hachés) ----
export function newRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const s = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.trim().toLowerCase().replace(/[^a-z2-7]/g, "")).digest("hex");
}
