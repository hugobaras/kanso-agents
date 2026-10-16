import { decryptFile, encryptFile, fileAad } from "./crypto.js";

/**
 * Analyse IA des pièces du Portail : toujours limitée à UN dossier, jamais
 * d'action automatique, réponses citées (pièce + page) ou « non trouvé ».
 */

/** Version de l'avenant DPA « Analyse IA » : la changer désactive l'IA jusqu'à nouvelle acceptation. */
export const AI_TERMS_VERSION = "2026-10-ia-v1";

export function aiEffective(settings: { ai_enabled?: boolean | null; ai_terms_version?: string | null } | undefined): boolean {
  return !!settings?.ai_enabled && settings.ai_terms_version === AI_TERMS_VERSION;
}

/** Texte d'une pièce, une entrée par page (index 0 = page 1). */
export type PageTexts = string[];

// Distinct AAD from the file itself: a text blob can never be swapped for a file blob.
const textAad = (tenantId: string, dossierId: string, fileId: string) => `${fileAad(tenantId, dossierId, fileId)}#text`;

export function encryptPageTexts(kek: Buffer, tenantId: string, dossierId: string, fileId: string, pages: PageTexts) {
  return encryptFile(kek, Buffer.from(JSON.stringify(pages), "utf8"), textAad(tenantId, dossierId, fileId));
}

export function decryptPageTexts(kek: Buffer, tenantId: string, dossierId: string, fileId: string, blob: Buffer, wrappedKey: Buffer): PageTexts {
  const raw = decryptFile(kek, blob, wrappedKey, textAad(tenantId, dossierId, fileId));
  const parsed: unknown = JSON.parse(raw.toString("utf8"));
  return Array.isArray(parsed) ? parsed.map(String) : [];
}
