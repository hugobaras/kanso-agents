export type Stage = "a_completer" | "en_verification" | "complet" | "termine";
export type ItemStatus = "pending" | "received" | "accepted" | "refused";

export const STAGES: Stage[] = ["a_completer", "en_verification", "complet", "termine"];

export const DEFAULT_STAGE_LABELS: Record<Stage, string> = {
  a_completer: "À compléter",
  en_verification: "En cours de vérification",
  complet: "Complet",
  termine: "Terminé",
};

export function stageLabels(overrides: Partial<Record<Stage, string>> | null | undefined): Record<Stage, string> {
  const out = { ...DEFAULT_STAGE_LABELS };
  for (const s of STAGES) {
    const v = overrides?.[s]?.trim();
    if (v) out[s] = v.slice(0, 40);
  }
  return out;
}

export type ItemLike = { required: boolean; status: ItemStatus; hasFile: boolean };

/** Une pièce est « fournie » quand un fichier sain a été déposé et qu'elle n'est pas refusée. */
export function isProvided(i: ItemLike): boolean {
  return i.status === "accepted" || (i.status === "received" && i.hasFile);
}

export function progress(items: ItemLike[]): { provided: number; total: number; required: number; requiredProvided: number } {
  const required = items.filter((i) => i.required);
  return {
    provided: items.filter(isProvided).length,
    total: items.length,
    required: required.length,
    requiredProvided: required.filter(isProvided).length,
  };
}

/** Toutes les pièces obligatoires sont fournies (et il y en a au moins une à fournir). */
export function isComplete(items: ItemLike[]): boolean {
  const p = progress(items);
  return p.required > 0 ? p.requiredProvided === p.required : p.total > 0 && p.provided === p.total;
}

export function allAccepted(items: ItemLike[]): boolean {
  const required = items.filter((i) => i.required);
  return required.length > 0 && required.every((i) => i.status === "accepted");
}

/**
 * Étape automatique d'après les pièces (le cabinet clôture à la main) :
 *  - toutes les pièces obligatoires acceptées → Complet
 *  - toutes fournies, en attente de vérification → En cours de vérification
 *  - sinon → À compléter
 * Un dossier terminé le reste jusqu'à réouverture.
 */
export function computeStage(current: Stage, items: ItemLike[]): Stage {
  if (current === "termine") return "termine";
  if (allAccepted(items)) return "complet";
  if (isComplete(items)) return "en_verification";
  return "a_completer";
}
