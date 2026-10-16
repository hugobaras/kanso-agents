import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomInt } from "node:crypto";

/**
 * Chiffrement par enveloppe (AES-256-GCM).
 *  - une clé aléatoire par fichier chiffre le contenu ;
 *  - cette clé est « enveloppée » par une clé propre au cabinet, dérivée de la
 *    clé maître (HKDF) : un cabinet ne partage jamais de clé avec un autre ;
 *  - tenant + dossier + fichier sont liés au chiffré (AAD) : un blob recopié
 *    ailleurs ne se déchiffre pas.
 */
export const CURRENT_KEY_VERSION = 1;

export function tenantKek(masterKey: string, tenantId: string, version = CURRENT_KEY_VERSION): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(masterKey, "utf8"), Buffer.from(`kanso-portail:v${version}`), Buffer.from(`tenant:${tenantId}`), 32),
  );
}

function seal(key: Buffer, plaintext: Buffer, aad: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
}

function open(key: Buffer, sealed: Buffer, aad: string): Buffer {
  if (sealed.length < 12 + 16) throw new Error("portal_blob_truncated");
  const iv = sealed.subarray(0, 12);
  const tag = sealed.subarray(sealed.length - 16);
  const ct = sealed.subarray(12, sealed.length - 16);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export function fileAad(tenantId: string, dossierId: string, fileId: string): string {
  return `portail|${tenantId}|${dossierId}|${fileId}`;
}

export function encryptFile(kek: Buffer, plaintext: Buffer, aad: string): { blob: Buffer; wrappedKey: Buffer } {
  const fileKey = randomBytes(32);
  const blob = seal(fileKey, plaintext, aad);
  const wrappedKey = seal(kek, fileKey, `key|${aad}`);
  fileKey.fill(0);
  return { blob, wrappedKey };
}

export function decryptFile(kek: Buffer, blob: Buffer, wrappedKey: Buffer, aad: string): Buffer {
  const fileKey = open(kek, wrappedKey, `key|${aad}`);
  try {
    return open(fileKey, blob, aad);
  } finally {
    fileKey.fill(0);
  }
}

// ---- Accès client : jetons et codes -----------------------------------------

export function newLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Code à 6 chiffres, uniformément tiré. */
export function newLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Le code est lié au contact : un hash volé ne sert pas pour un autre contact. */
export function hashCode(contactId: string, code: string): string {
  return createHash("sha256").update(`${contactId}:${code}`).digest("hex");
}
