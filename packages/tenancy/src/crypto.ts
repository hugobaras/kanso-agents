import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { KansoError } from "@kanso/shared";

function deriveKey(masterKey: string): Buffer {
  if (masterKey.length < 16) {
    throw new KansoError("KANSO_MASTER_KEY too short", "weak_master_key");
  }
  return createHash("sha256").update(masterKey).digest();
}

/** AES-256-GCM: iv(12) | tag(16) | ciphertext */
export function encryptJson(masterKey: string, value: unknown): Buffer {
  const key = deriveKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptJson<T>(masterKey: string, blob: Buffer): T {
  const key = deriveKey(masterKey);
  if (blob.length < 28) {
    throw new KansoError("Invalid ciphertext", "bad_ciphertext");
  }
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
