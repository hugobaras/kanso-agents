export type Profession = "avocat" | "expert_comptable" | "notaire" | "autre";

export type TemplateItem = { label: string; hint?: string; required: boolean };

export type DossierTemplate = {
  key: string;
  profession: Profession | "all";
  name: string;
  description: string;
  clientKind: "particulier" | "entreprise" | "both";
  items: TemplateItem[];
};

const ID = "Pièce d'identité en cours de validité (recto verso)";
const DOMICILE = "Justificatif de domicile de moins de 3 mois";

/**
 * Modèles de départ : des listes usuelles, à adapter par le cabinet.
 * Ils n'ont aucune valeur de conseil juridique, comptable ou fiscal.
 */
export const SYSTEM_TEMPLATES: DossierTemplate[] = [
  {
    key: "libre",
    profession: "all",
    name: "Dossier libre",
    description: "Une liste vide à composer vous-même.",
    clientKind: "both",
    items: [],
  },
  // ---- Experts-comptables ------------------------------------------------
  {
    key: "ec-bilan",
    profession: "expert_comptable",
    name: "Bilan annuel",
    description: "Pièces habituelles pour clôturer un exercice.",
    clientKind: "entreprise",
    items: [
      { label: "Relevés bancaires de l'exercice", hint: "Tous les comptes, du premier au dernier jour de l'exercice.", required: true },
      { label: "Factures de ventes", hint: "Ou le journal de ventes si vous en avez un.", required: true },
      { label: "Factures d'achats et de frais", required: true },
      { label: "Contrats d'emprunt et tableaux d'amortissement", required: false },
      { label: "Relevé des immobilisations acquises ou cédées", hint: "Achats de matériel, véhicules, travaux…", required: false },
      { label: "Bulletins de paie ou récapitulatif des salaires", required: false },
      { label: "Dernières déclarations de TVA", required: false },
    ],
  },
  {
    key: "ec-creation",
    profession: "expert_comptable",
    name: "Création d'entreprise",
    description: "Pièces à réunir pour immatriculer une société.",
    clientKind: "entreprise",
    items: [
      { label: ID, hint: "Pour chaque associé et dirigeant.", required: true },
      { label: DOMICILE, hint: "Pour chaque associé et dirigeant.", required: true },
      { label: "Projet de statuts ou informations sur la société", hint: "Dénomination, objet, capital, répartition des parts.", required: true },
      { label: "Justificatif de l'adresse du siège", hint: "Bail, attestation de domiciliation, titre de propriété…", required: true },
      { label: "Attestation de dépôt des fonds", required: false },
    ],
  },
  {
    key: "ec-revenus",
    profession: "expert_comptable",
    name: "Déclaration de revenus (particulier)",
    description: "Justificatifs pour préparer une déclaration.",
    clientKind: "particulier",
    items: [
      { label: "Dernier avis d'imposition", required: true },
      { label: "Justificatifs de revenus de l'année", hint: "Salaires, pensions, revenus fonciers, de capitaux…", required: true },
      { label: "Justificatifs de charges et de dons", required: false },
      { label: "Attestations (garde d'enfants, emploi à domicile, etc.)", required: false },
    ],
  },
  // ---- Avocats -------------------------------------------------------------
  {
    key: "av-ouverture-particulier",
    profession: "avocat",
    name: "Ouverture de dossier — particulier",
    description: "Documents utiles pour étudier votre situation.",
    clientKind: "particulier",
    items: [
      { label: ID, required: true },
      { label: DOMICILE, required: true },
      { label: "Documents relatifs à votre affaire", hint: "Contrats, courriers, jugements, convocations, échanges écrits…", required: true },
      { label: "Chronologie des faits (quelques lignes)", hint: "Un document texte ou une photo d'un écrit à la main.", required: false },
      { label: "Convention d'honoraires retournée signée", hint: "Si le cabinet vous l'a transmise.", required: false },
    ],
  },
  {
    key: "av-entreprise",
    profession: "avocat",
    name: "Dossier entreprise",
    description: "Éléments sur la société et le litige ou le projet.",
    clientKind: "entreprise",
    items: [
      { label: "Extrait Kbis de moins de 3 mois", required: true },
      { label: "Statuts à jour", required: true },
      { label: "Contrats et documents relatifs à l'affaire", required: true },
      { label: "Échanges de courriers et de courriels pertinents", required: false },
      { label: "Pièce d'identité du représentant légal", required: true },
    ],
  },
  {
    key: "av-famille",
    profession: "avocat",
    name: "Famille",
    description: "Pièces habituelles d'un dossier familial.",
    clientKind: "particulier",
    items: [
      { label: ID, required: true },
      { label: "Livret de famille", required: true },
      { label: "Contrat de mariage ou de PACS, le cas échéant", required: false },
      { label: "Derniers avis d'imposition", required: true },
      { label: "Justificatifs de revenus et de charges", required: false },
      { label: "Relevés de comptes et justificatifs de patrimoine", required: false },
    ],
  },
  // ---- Notaires --------------------------------------------------------------
  {
    key: "no-vente-vendeur",
    profession: "notaire",
    name: "Vente immobilière — vendeur",
    description: "Pièces à fournir par le vendeur.",
    clientKind: "particulier",
    items: [
      { label: ID, hint: "Pour chaque vendeur.", required: true },
      { label: "Livret de famille ou contrat de mariage / PACS", required: true },
      { label: "Titre de propriété (acte d'achat)", required: true },
      { label: "Dernier avis de taxe foncière", required: true },
      { label: "Diagnostics techniques disponibles", required: false },
      { label: "Documents de copropriété (règlement, procès-verbaux, charges)", hint: "Si le bien est en copropriété.", required: false },
    ],
  },
  {
    key: "no-achat-acquereur",
    profession: "notaire",
    name: "Achat immobilier — acquéreur",
    description: "Pièces à fournir par l'acquéreur.",
    clientKind: "particulier",
    items: [
      { label: ID, hint: "Pour chaque acquéreur.", required: true },
      { label: DOMICILE, required: true },
      { label: "Livret de famille ou contrat de mariage / PACS", required: true },
      { label: "Compromis ou promesse de vente signé", required: true },
      { label: "Offre de prêt ou plan de financement", required: true },
      { label: "Justificatif de l'apport personnel", required: false },
    ],
  },
  {
    key: "no-succession",
    profession: "notaire",
    name: "Succession",
    description: "Éléments pour ouvrir et instruire une succession.",
    clientKind: "particulier",
    items: [
      { label: "Acte de décès", required: true },
      { label: "Livret de famille du défunt", required: true },
      { label: ID, hint: "Pour chaque héritier.", required: true },
      { label: "Testament ou donation connus", required: false },
      { label: "Relevés des comptes bancaires du défunt", required: false },
      { label: "Titres de propriété et justificatifs du patrimoine", required: false },
    ],
  },
];

export function templatesFor(profession: Profession | null | undefined): DossierTemplate[] {
  return SYSTEM_TEMPLATES.filter((t) => t.profession === "all" || !profession || profession === "autre" || t.profession === profession);
}

export function findSystemTemplate(key: string): DossierTemplate | undefined {
  return SYSTEM_TEMPLATES.find((t) => t.key === key);
}
