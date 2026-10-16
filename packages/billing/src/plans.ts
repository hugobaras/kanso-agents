/**
 * Catalogue des offres (D-133). Prix HT en centimes d'euro.
 * Les prix Stripe sont retrouvés par lookup_key (`kanso_<plan>_<interval>`),
 * créés par scripts/stripe-seed.mts.
 */

export type PlanId = "trial" | "essentiel" | "cabinet" | "expert";
export type PaidPlanId = Exclude<PlanId, "trial">;
export type BillingInterval = "month" | "year";
export type Metric = "conversations" | "documents";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  /** Annuel = 10 mois. */
  yearlyPriceCents: number;
  modules: { inbound: boolean; document_to_action: boolean };
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
    name: "Essai",
    tagline: "14 jours pour tout tester, sans carte bancaire.",
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    modules: { inbound: true, document_to_action: true },
    quotas: { conversations: 50, documents: 20 },
    seats: 2,
    integrations: "standard",
    customRequests: false,
    highlights: ["Assistant d'accueil", "Traitement de documents", "2 utilisateurs"],
  },
  essentiel: {
    id: "essentiel",
    name: "Essentiel",
    tagline: "L'assistant d'accueil qui qualifie vos demandes entrantes.",
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    modules: { inbound: true, document_to_action: false },
    quotas: { conversations: 200, documents: 0 },
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
    name: "Cabinet",
    tagline: "Accueil et documents, pour les cabinets qui veulent gagner du temps.",
    monthlyPriceCents: 12900,
    yearlyPriceCents: 129000,
    modules: { inbound: true, document_to_action: true },
    quotas: { conversations: 600, documents: 150 },
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
    name: "Expert",
    tagline: "Pour les structures multi-associés et les gros volumes.",
    monthlyPriceCents: 29000,
    yearlyPriceCents: 290000,
    modules: { inbound: true, document_to_action: true },
    quotas: { conversations: 2000, documents: 800 },
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
};

export const PAID_PLANS: PaidPlanId[] = ["essentiel", "cabinet", "expert"];

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

export function isPaidPlanId(v: unknown): v is PaidPlanId {
  return typeof v === "string" && (PAID_PLANS as string[]).includes(v);
}

export function lookupKey(plan: PaidPlanId, interval: BillingInterval): string {
  return `kanso_${plan}_${interval}`;
}

export function parseLookupKey(
  key: string | null | undefined,
): { plan: PaidPlanId; interval: BillingInterval } | null {
  const m = /^kanso_(essentiel|cabinet|expert)_(month|year)$/.exec(key ?? "");
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
