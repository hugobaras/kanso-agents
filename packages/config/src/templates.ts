import type { InboundConfig } from "./inbound.js";
import type { DocumentToActionConfig } from "./document-to-action.js";

export type Profession = "avocat" | "expert_comptable" | "notaire" | "autre";

export const PROFESSIONS: Array<{ id: Profession; label: string; description: string }> = [
  { id: "avocat", label: "Cabinet d'avocats", description: "Qualification par domaine du droit et urgence." },
  { id: "expert_comptable", label: "Expertise comptable", description: "Besoin, taille de structure, échéances." },
  { id: "notaire", label: "Office notarial", description: "Type d'acte, calendrier, situation." },
  { id: "autre", label: "Autre profession libérale", description: "Questionnaire générique à adapter." },
];

export const EMAIL_ALERT_SECRET_REF = "alerts.intake_email";
export const SLACK_ALERT_SECRET_REF = "alerts.intake_slack";

const WEEK_HOURS: InboundConfig["operations"]["business_hours"] = {
  mon: [["09:00", "12:30"], ["14:00", "18:30"]],
  tue: [["09:00", "12:30"], ["14:00", "18:30"]],
  wed: [["09:00", "12:30"], ["14:00", "18:30"]],
  thu: [["09:00", "12:30"], ["14:00", "18:30"]],
  fri: [["09:00", "12:30"], ["14:00", "17:30"]],
  sat: [],
  sun: [],
};

type ProfessionPreset = {
  notice: (name: string) => string;
  forbidden: string[];
  keywords: string[];
  questions: InboundConfig["qualification"]["questions"];
  weights: InboundConfig["scoring"]["weights"];
};

const contactQuestions: InboundConfig["qualification"]["questions"] = [
  { id: "contact_name", prompt: "Quel est votre nom ?", type: "free_text", required: true },
  {
    id: "contact_email",
    prompt: "À quelle adresse e-mail pouvons-nous vous répondre ?",
    type: "free_text",
    required: true,
  },
];

const contactWeights: InboundConfig["scoring"]["weights"] = {
  contact_name: { kind: "free_text", points_if_non_empty: 5 },
  contact_email: { kind: "free_text", points_if_non_empty: 5 },
};

const urgencyQuestion = {
  id: "urgency",
  prompt: "Sous quel délai souhaitez-vous un premier échange ?",
  type: "single_choice" as const,
  required: true,
  options: [
    { id: "48h", label: "Sous 48 h" },
    { id: "week", label: "Dans la semaine" },
    { id: "flex", label: "Pas d'urgence" },
  ],
};
const urgencyWeight = {
  kind: "choice_map" as const,
  points: { "48h": 35, week: 20, flex: 8 },
};

const PRESETS: Record<Profession, ProfessionPreset> = {
  avocat: {
    notice: (n) =>
      `Vous échangez avec l'assistant automatisé de ${n}. Ce n'est pas un avocat : ses réponses ne constituent pas un conseil juridique.`,
    forbidden: ["conseil_juridique", "conseil_comptable", "diagnostic_medical"],
    keywords: ["parler à un avocat", "urgence", "garde à vue"],
    questions: [
      {
        id: "matter_type",
        prompt: "Quel est le domaine de votre demande ?",
        type: "single_choice",
        required: true,
        options: [
          { id: "famille", label: "Famille / divorce" },
          { id: "travail", label: "Droit du travail" },
          { id: "societes", label: "Droit des sociétés" },
          { id: "immobilier", label: "Immobilier / baux" },
          { id: "penal", label: "Pénal" },
          { id: "autre", label: "Autre" },
        ],
      },
      urgencyQuestion,
      {
        id: "client_type",
        prompt: "Vous nous contactez en tant que…",
        type: "single_choice",
        required: true,
        options: [
          { id: "particulier", label: "Particulier" },
          { id: "entreprise", label: "Entreprise" },
        ],
      },
      ...contactQuestions,
    ],
    weights: {
      matter_type: {
        kind: "choice_map",
        points: { famille: 25, travail: 30, societes: 35, immobilier: 25, penal: 30, autre: 10 },
      },
      urgency: urgencyWeight,
      client_type: { kind: "choice_map", points: { particulier: 10, entreprise: 20 } },
      ...contactWeights,
    },
  },
  expert_comptable: {
    notice: (n) =>
      `Vous échangez avec l'assistant automatisé de ${n}. Ce n'est pas un expert-comptable : ses réponses ne constituent pas un conseil comptable ou fiscal.`,
    forbidden: ["conseil_comptable", "conseil_fiscal", "conseil_juridique"],
    keywords: ["parler à un expert", "contrôle fiscal", "urgence"],
    questions: [
      {
        id: "need_type",
        prompt: "Quel est votre besoin principal ?",
        type: "single_choice",
        required: true,
        options: [
          { id: "creation", label: "Création d'entreprise" },
          { id: "tenue", label: "Tenue comptable" },
          { id: "bilan", label: "Bilan / liasse fiscale" },
          { id: "paie", label: "Paie / social" },
          { id: "autre", label: "Autre" },
        ],
      },
      {
        id: "company_size",
        prompt: "Quelle est la taille de votre structure ?",
        type: "single_choice",
        required: true,
        options: [
          { id: "solo", label: "Indépendant / micro" },
          { id: "tpe", label: "TPE (moins de 10)" },
          { id: "pme", label: "PME (10 à 50)" },
          { id: "plus", label: "Plus de 50" },
        ],
      },
      urgencyQuestion,
      ...contactQuestions,
    ],
    weights: {
      need_type: {
        kind: "choice_map",
        points: { creation: 25, tenue: 30, bilan: 30, paie: 25, autre: 10 },
      },
      company_size: { kind: "choice_map", points: { solo: 10, tpe: 20, pme: 25, plus: 25 } },
      urgency: urgencyWeight,
      ...contactWeights,
    },
  },
  notaire: {
    notice: (n) =>
      `Vous échangez avec l'assistant automatisé de ${n}. Ce n'est pas un notaire : ses réponses ne constituent pas un conseil juridique.`,
    forbidden: ["conseil_juridique", "conseil_fiscal", "conseil_comptable"],
    keywords: ["parler au notaire", "urgence", "signature"],
    questions: [
      {
        id: "act_type",
        prompt: "Pour quel type d'acte nous contactez-vous ?",
        type: "single_choice",
        required: true,
        options: [
          { id: "vente", label: "Achat / vente immobilière" },
          { id: "succession", label: "Succession" },
          { id: "donation", label: "Donation" },
          { id: "mariage", label: "Contrat de mariage / PACS" },
          { id: "societe", label: "Société" },
          { id: "autre", label: "Autre" },
        ],
      },
      {
        id: "timeline",
        prompt: "Où en est votre projet ?",
        type: "single_choice",
        required: true,
        options: [
          { id: "compromis", label: "Compromis signé / date fixée" },
          { id: "en_cours", label: "En cours de préparation" },
          { id: "renseignement", label: "Simple renseignement" },
        ],
      },
      ...contactQuestions,
    ],
    weights: {
      act_type: {
        kind: "choice_map",
        points: { vente: 35, succession: 30, donation: 25, mariage: 20, societe: 25, autre: 10 },
      },
      timeline: { kind: "choice_map", points: { compromis: 40, en_cours: 25, renseignement: 5 } },
      ...contactWeights,
    },
  },
  autre: {
    notice: (n) =>
      `Vous échangez avec l'assistant automatisé de ${n}. Ses réponses sont indicatives et ne remplacent pas l'avis d'un professionnel.`,
    forbidden: ["conseil_juridique", "conseil_comptable", "diagnostic_medical"],
    keywords: ["parler à quelqu'un", "urgence"],
    questions: [
      {
        id: "request_type",
        prompt: "Quel est l'objet de votre demande ?",
        type: "single_choice",
        required: true,
        options: [
          { id: "nouveau", label: "Nouveau dossier" },
          { id: "suivi", label: "Suivi d'un dossier" },
          { id: "info", label: "Renseignement" },
        ],
      },
      urgencyQuestion,
      ...contactQuestions,
    ],
    weights: {
      request_type: { kind: "choice_map", points: { nouveau: 40, suivi: 20, info: 10 } },
      urgency: urgencyWeight,
      ...contactWeights,
    },
  },
};

export function buildInboundTemplate(opts: {
  profession: Profession;
  displayName: string;
  primaryColor?: string;
}): InboundConfig {
  const p = PRESETS[opts.profession];
  return {
    schema_version: "1.1.0",
    product: "inbound",
    identity: {
      display_name: opts.displayName,
      locale_default: "fr",
      branding: { primary_color: opts.primaryColor ?? "#1B2A4A", logo_url: null },
      welcome_message: "Bonjour, je peux transmettre votre demande au cabinet en quelques questions.",
    },
    disclosure: { ai_notice: p.notice(opts.displayName), forbidden_topics: p.forbidden },
    qualification: { questions: p.questions },
    scoring: { max_score: 100, thresholds: { hot: 70, warm: 40, cold: 0 }, weights: p.weights },
    alerts: { channels: [] },
    operations: {
      timezone: "Europe/Paris",
      languages: ["fr"],
      business_hours: WEEK_HOURS,
      after_hours_mode: "qualify",
      escalation: {
        user_requests_human: true,
        keywords: p.keywords,
        message: "Je transmets votre demande à l'équipe. Un collaborateur pourra vous recontacter.",
      },
    },
  };
}

export function buildDocumentTemplate(): DocumentToActionConfig {
  return {
    schema_version: "1.1.0",
    product: "document_to_action",
    sources: [{ type: "upload_web", options: { max_size_mb: 10 } }],
    documents: {
      accepted_types: ["invoice", "quote"],
      fields_by_type: {
        invoice: [
          "vendor_name",
          "invoice_number",
          "invoice_date",
          "currency",
          "total_ht",
          "vat_amount",
          "total_ttc",
          "iban",
          "due_date",
        ],
        quote: ["vendor_name", "quote_number", "quote_date", "total_ht", "total_ttc", "validity_date"],
      },
    },
    validation: {
      rules: [
        { id: "confidence", kind: "confidence_min", params: { min: 0.8 } },
        { id: "totals", kind: "totals_coherent", params: { tolerance_eur: 0.05 } },
        { id: "dup", kind: "duplicate_check", params: { keys: ["vendor_name", "invoice_number"] } },
        { id: "approval", kind: "approval_threshold", params: { amount_field: "total_ttc", max_auto_draft_eur: 5000 } },
      ],
    },
    action: {
      target: { provider: "pennylane", secret_ref: "targets.pennylane" },
      mode: "draft",
      on_failure: "queue_anomaly",
      require_review: true,
      sandbox: true,
    },
    alerts: { human_review: { min_confidence: 0.8, channels: [] } },
  };
}
