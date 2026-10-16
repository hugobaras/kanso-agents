/**
 * Analyse IA des pièces du Portail : toujours limitée à UN dossier, jamais
 * d'action automatique, réponses citées (pièce + page) ou « non trouvé ».
 */

/** Version de l'avenant DPA « Analyse IA » : la changer désactive l'IA jusqu'à nouvelle acceptation. */
export const AI_TERMS_VERSION = "2026-10-ia-v1";

export function aiEffective(settings: { ai_enabled?: boolean | null; ai_terms_version?: string | null } | undefined): boolean {
  return !!settings?.ai_enabled && settings.ai_terms_version === AI_TERMS_VERSION;
}
