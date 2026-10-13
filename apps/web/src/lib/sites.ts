/**
 * Les quatre sites servis par cette app :
 *   solutions — Kanso Solutions (ombrelle, présente les produits)
 *   assistant — Kanso Assistant (produit + application)
 *   site      — Kanso Site (création de sites sur mesure)
 *   portail   — Kanso Portail (vitrine, produit en conception)
 *
 * En développement, les sites sont joignables par chemin :
 *   /  (Solutions) · /assistant · /site · /portail
 * (l'application d'Assistant — /app, /connexion, /inscription… — reste à la racine).
 * En production, chacun a son domaine : NEXT_PUBLIC_SITES_MODE=host et
 * NEXT_PUBLIC_URL_<SITE>=https://… ; le proxy réécrit selon l'hôte.
 */
export type SiteId = "solutions" | "assistant" | "site" | "portail";

export type SiteDef = {
  id: SiteId;
  name: string;
  /** Mot affiché sous « Kanso » dans le logo. */
  label: string;
  tagline: string;
  accent: { base: string; soft: string; strong: string };
  /** Préfixe de route interne ("" = racine de l'app). */
  route: string;
};

export const SITES: Record<SiteId, SiteDef> = {
  solutions: {
    id: "solutions",
    name: "Kanso Solutions",
    label: "Solutions",
    tagline: "Des outils simples pour les professions du droit et du chiffre.",
    accent: { base: "#1F6F6B", soft: "#E5F1EF", strong: "#16524F" },
    route: "",
  },
  assistant: {
    id: "assistant",
    name: "Kanso Assistant",
    label: "Assistant",
    tagline: "L'assistant qui reçoit, qualifie et classe pour votre cabinet.",
    accent: { base: "#1F6F6B", soft: "#E5F1EF", strong: "#16524F" },
    route: "/assistant",
  },
  site: {
    id: "site",
    name: "Kanso Site",
    label: "Site",
    tagline: "Le site internet de votre cabinet, conçu sur mesure.",
    accent: { base: "#B4532A", soft: "#F7E9E2", strong: "#8F3F1E" },
    route: "/site",
  },
  portail: {
    id: "portail",
    name: "Kanso Portail",
    label: "Portail",
    tagline: "L'espace client sécurisé de votre cabinet.",
    accent: { base: "#2D5B8A", soft: "#E6EEF7", strong: "#1F4468" },
    route: "/portail",
  },
};

const ENV_URL: Record<SiteId, string | undefined> = {
  solutions: process.env.NEXT_PUBLIC_URL_SOLUTIONS,
  assistant: process.env.NEXT_PUBLIC_URL_ASSISTANT,
  site: process.env.NEXT_PUBLIC_URL_SITE,
  portail: process.env.NEXT_PUBLIC_URL_PORTAIL,
};

export const HOST_MODE = process.env.NEXT_PUBLIC_SITES_MODE === "host";

/** URL (relative en dev, absolue en production) d'une page d'un site. */
export function siteHref(site: SiteId, path = "/"): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  if (HOST_MODE && ENV_URL[site]) return `${ENV_URL[site]!.replace(/\/$/, "")}${clean}` || "/";
  return `${SITES[site].route}${clean}` || "/";
}

export function themeStyle(site: SiteId): React.CSSProperties {
  const a = SITES[site].accent;
  return {
    "--color-accent": a.base,
    "--color-accent-soft": a.soft,
    "--color-accent-strong": a.strong,
  } as React.CSSProperties;
}

export const PRODUCT_ORDER: SiteId[] = ["assistant", "site", "portail"];

export const PRODUCT_BLURB: Record<Exclude<SiteId, "solutions">, { summary: string; status: string }> = {
  assistant: {
    summary: "Reçoit les demandes de vos futurs clients, les qualifie et les classe par priorité. Traite aussi vos factures fournisseurs.",
    status: "Disponible",
  },
  site: {
    summary: "Votre site internet professionnel, conçu sur mesure pour votre cabinet, avec l'assistant intégré.",
    status: "Sur devis",
  },
  portail: {
    summary: "Un espace client sécurisé pour échanger les pièces et suivre les dossiers.",
    status: "En conception",
  },
};
