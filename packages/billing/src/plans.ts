/**
 * Catalogue des offres (D-133). Prix HT en centimes d'euro.
 * Les prix Stripe sont retrouvés par lookup_key (`kanso_<plan>_<interval>`),
 * créés par scripts/stripe-seed.mts.
 */

export type PlanId =
  | "trial"
  | "essentiel"
  | "cabinet"
  | "expert"
  | "portail_trial"
  | "portail_essentiel"
  | "portail_cabinet";
export type PaidPlanId = Exclude<PlanId, "trial" | "portail_trial">;
/** Produit facturé : un espace n'a qu'un abonnement, donc un seul produit. */
export type PlanProduct = "assistant" | "portail";
export type BillingInterval = "month" | "year";
/** ai_pages : pages de pièces Portail analysées par l'IA. */
export type Metric = "conversations" | "documents" | "ai_pages";

export type Plan = {
  id: PlanId;
  product: PlanProduct;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  /** Annuel = 10 mois. */
  yearlyPriceCents: number;
  modules: { inbound: boolean; document_to_action: boolean; portail: boolean };
  quotas: Record<Metric, number>;
  seats: number;
  integrations: "email" | "standard" | "all";
  customRequests: boolean;
  highlights: string[];
};

export const TRIAL_DAYS = 14;

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    product: "assistant",
    name: "Essai",
    tagline: "14 jours pour tout tester, sans carte bancaire.",
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    modules: { inbound: true, document_to_action: true, portail: false },
    quotas: { conversations: 50, documents: 20, ai_pages: 0 },
    seats: 2,
    integrations: "standard",
    customRequests: false,
    highlights: ["Assistant d'accueil", "Traitement de documents", "2 utilisateurs"],
  },
  essentiel: {
    id: "essentiel",
    product: "assistant",
    name: "Essentiel",
    tagline: "L'assistant d'accueil qui qualifie vos demandes entrantes.",
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    modules: { inbound: true, document_to_action: false, portail: false },
    quotas: { conversations: 200, documents: 0, ai_pages: 0 },
    seats: 2,
    integrations: "email",
    customRequests: false,
    highlights: [
      "200 conversations / mois",
      "Questions et scoring sur mesure",
      "Alertes e-mail",
      "2 utilisateurs",
    ],
  },
  cabinet: {
    id: "cabinet",
    product: "assistant",
    name: "Cabinet",
    tagline: "Accueil et documents, pour les cabinets qui veulent gagner du temps.",
    monthlyPriceCents: 12900,
    yearlyPriceCents: 129000,
    modules: { inbound: true, document_to_action: true, portail: false },
    quotas: { conversations: 600, documents: 150, ai_pages: 0 },
    seats: 5,
    integrations: "standard",
    customRequests: false,
    highlights: [
      "600 conversations / mois",
      "150 documents / mois",
      "Slack, HubSpot, Pennylane…",
      "5 utilisateurs",
    ],
  },
  expert: {
    id: "expert",
    product: "assistant",
    name: "Expert",
    tagline: "Pour les structures multi-associés et les gros volumes.",
    monthlyPriceCents: 29000,
    yearlyPriceCents: 290000,
    modules: { inbound: true, document_to_action: true, portail: false },
    quotas: { conversations: 2000, documents: 800, ai_pages: 0 },
    seats: 15,
    integrations: "all",
    customRequests: true,
    highlights: [
      "2 000 conversations / mois",
      "800 documents / mois",
      "Toutes les intégrations + sur-mesure",
      "15 utilisateurs, support prioritaire",
    ],
  },
  portail_trial: {
    id: "portail_trial",
    // shortcut: trial gets 30 AI pages to evaluate the Cabinet feature; set to 0 if it must stay Cabinet-only.
    product: "portail",
    name: "Essai Portail",
    tagline: "14 jours pour tester le Portail, sans carte bancaire.",
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    modules: { inbound: false, document_to_action: false, portail: true },
    quotas: { conversations: 0, documents: 0, ai_pages: 30 },
    seats: 3,
    integrations: "email",
    customRequests: false,
    highlights: ["Dépôt de pièces chiffré", "Suivi de dossier", "3 utilisateurs"],
  },
  portail_essentiel: {
    id: "portail_essentiel",
    product: "portail",
    name: "Portail Essentiel",
    tagline: "L'espace client sécurisé pour les petits cabinets.",
    monthlyPriceCents: 2900,
    yearlyPriceCents: 29000,
    modules: { inbound: false, document_to_action: false, portail: true },
    quotas: { conversations: 0, documents: 0, ai_pages: 0 },
    seats: 3,
    integrations: "email",
    customRequests: false,
    highlights: ["Dépôt de pièces chiffré", "Modèles de dossiers", "Relances automatiques", "3 utilisateurs"],
  },
  portail_cabinet: {
    id: "portail_cabinet",
    product: "portail",
    name: "Portail Cabinet",
    tagline: "Pour les cabinets qui échangent des pièces tous les jours.",
    monthlyPriceCents: 6900,
    yearlyPriceCents: 69000,
    modules: { inbound: false, document_to_action: false, portail: true },
    quotas: { conversations: 0, documents: 0, ai_pages: 300 },
    seats: 10,
    integrations: "email",
    customRequests: false,
    highlights: ["Tout Portail Essentiel", "Analyse IA des pièces (300 pages / mois)", "Export et clôture de dossier", "10 utilisateurs"],
  },
};

export const PAID_PLANS: PaidPlanId[] = ["essentiel", "cabinet", "expert"];
export const PORTAIL_PLANS: PaidPlanId[] = ["portail_essentiel", "portail_cabinet"];
/** Tous les plans payants, tous produits confondus (Stripe, MRR). */
export const ALL_PAID_PLANS: PaidPlanId[] = [...PAID_PLANS, ...PORTAIL_PLANS];

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

export function isPaidPlanId(v: unknown): v is PaidPlanId {
  return typeof v === "string" && (ALL_PAID_PLANS as string[]).includes(v);
}

export function lookupKey(plan: PaidPlanId, interval: BillingInterval): string {
  return `kanso_${plan}_${interval}`;
}

export function parseLookupKey(
  key: string | null | undefined,
): { plan: PaidPlanId; interval: BillingInterval } | null {
  const m = /^kanso_(essentiel|cabinet|expert|portail_essentiel|portail_cabinet)_(month|year)$/.exec(key ?? "");
  if (!m) return null;
  return { plan: m[1] as PaidPlanId, interval: m[2] as BillingInterval };
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
