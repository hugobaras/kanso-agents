import type { InboundConfig } from "@kanso/config";
import type { LlmClient, LlmStructuredRequest, LlmUsage } from "@kanso/llm";
import { KansoError } from "@kanso/shared";

/**
 * Permissive inbound NLU for demo / rate-limit fallback.
 * Prefer mapping free-form FR to the closest config option over rejecting.
 */
export class InboundHeuristicLlmClient implements LlmClient {
  constructor(private readonly config: InboundConfig) {}

  async completeStructured<T>(
    req: LlmStructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    const expected = expectedQuestionFromSystem(req.system);
    const text = req.user.trim();
    const norm = normalize(text);

    const raw = classify(this.config, expected, text, norm);
    const data = req.schema.parse(raw);
    return {
      data,
      usage: {
        provider: "heuristic",
        modelId: "inbound-flexible-v2",
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }
}

function expectedQuestionFromSystem(system: string): string | undefined {
  const m = system.match(/Question attendue actuellement:\s*([a-z0-9_]+)/i);
  return m?.[1];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9@.+_\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(
  config: InboundConfig,
  expectedQuestionId: string | undefined,
  text: string,
  norm: string,
): {
  intent: string;
  answer: { question_id: string; value: string } | null;
  assistant_message: string;
  claimed_facts: string[];
} {
  if (!norm) {
    throw new KansoError("heuristic: empty", "heuristic_empty");
  }

  if (/\b(au revoir|bye|a plus|stop|ciao)\b/.test(norm)) {
    return {
      intent: "bye",
      answer: null,
      assistant_message: "D'accord, au revoir.",
      claimed_facts: [],
    };
  }
  if (
    /\b(humain|conseiller|avocat|collaborateur|parler (a|à) quelqu|appeler)\b/.test(
      norm,
    ) ||
    config.operations.escalation.keywords.some((k) =>
      norm.includes(normalize(k)),
    )
  ) {
    return {
      intent: "human",
      answer: null,
      assistant_message: config.operations.escalation.message,
      claimed_facts: [],
    };
  }

  const q = expectedQuestionId
    ? config.qualification.questions.find((x) => x.id === expectedQuestionId)
    : undefined;

  if (!q) {
    throw new KansoError("heuristic: no expected question", "heuristic_no_q");
  }

  if (q.type === "free_text") {
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    return {
      intent: "answer",
      answer: { question_id: q.id, value: email ?? text },
      assistant_message: "Merci, c'est noté.",
      claimed_facts: [],
    };
  }

  if (q.type === "single_choice" && q.options?.length) {
    const matched = matchOptionFlexible(q.id, q.options, norm);
    if (!matched) {
      const labels = q.options.map((o) => o.label).join(", ");
      return {
        intent: "other",
        answer: null,
        assistant_message: `Pouvez-vous préciser parmi : ${labels} ?`,
        claimed_facts: [],
      };
    }
    return {
      intent: "answer",
      answer: { question_id: q.id, value: matched },
      assistant_message: "Merci.",
      claimed_facts: [],
    };
  }

  // number / boolean / multi: accept raw text as value when possible
  if (q.type === "number") {
    const n = norm.match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".");
    if (n) {
      return {
        intent: "answer",
        answer: { question_id: q.id, value: n },
        assistant_message: "Merci.",
        claimed_facts: [],
      };
    }
  }
  if (q.type === "boolean") {
    if (/\b(oui|yes|ok|d accord|daccord|volontiers)\b/.test(norm)) {
      return {
        intent: "answer",
        answer: { question_id: q.id, value: "true" },
        assistant_message: "Merci.",
        claimed_facts: [],
      };
    }
    if (/\b(non|no|pas)\b/.test(norm)) {
      return {
        intent: "answer",
        answer: { question_id: q.id, value: "false" },
        assistant_message: "Merci.",
        claimed_facts: [],
      };
    }
  }

  throw new KansoError("heuristic: unsupported question", "heuristic_unsupported");
}

const WEEKDAYS =
  /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/;
const MONTHS =
  /\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/;

/** Option-id → FR cues (normalized, no accents). */
const SYNONYMS: Record<string, string[]> = {
  labor: [
    "travail",
    "social",
    "licenciement",
    "licencie",
    "employeur",
    "employe",
    "salarie",
    "salarial",
    "emploi",
    "rh",
    "contrat",
    "harcelement",
    "rupture",
    "convention",
    "prud homme",
    "prudhommes",
    "prudhomme",
    "cse",
    "syndicat",
  ],
  corporate: [
    "societe",
    "corporate",
    "entreprise",
    "commercial",
    "associe",
    "actionnaires",
    "statuts",
    "fusion",
    "cession",
    "holding",
    "sas",
    "sarl",
    "sci",
  ],
  other: ["autre", "divers", "general", "pas sure", "je ne sais", "plusieurs"],
  "48h": [
    "48",
    "urgent",
    "urgence",
    "demain",
    "aujourd hui",
    "aujourdhui",
    "ce soir",
    "ce matin",
    "rapidement",
    "asap",
    "tout de suite",
    "des que possible",
    "immediat",
    "au plus vite",
    "dans la journee",
    "dans 1 jour",
    "dans un jour",
    "dans 2 jour",
    "dans deux jour",
  ],
  week: [
    "semaine",
    "7 jour",
    "sept jour",
    "cette semaine",
    "d ici",
    "dici",
    "avant la fin",
    "prochainement",
    "dans les jours",
    "quelques jours",
    "debut de semaine",
    "fin de semaine",
    "week end",
    "weekend",
  ],
  flex: [
    "flex",
    "flexible",
    "pas presse",
    "quand vous voulez",
    "sans urgence",
    "plus tard",
    "a mon rythme",
    "pas d urgence",
    "quand possible",
    "des que vous pouvez",
    "ouvert",
  ],
};

function matchOptionFlexible(
  questionId: string,
  options: Array<{ id: string; label: string }>,
  norm: string,
): string | null {
  const ids = new Set(options.map((o) => o.id));

  // Exact / substring on id & label
  for (const opt of options) {
    const idN = normalize(opt.id);
    const labelN = normalize(opt.label);
    if (norm === idN || norm === labelN) return opt.id;
  }
  for (const opt of options) {
    const idN = normalize(opt.id);
    const labelN = normalize(opt.label);
    if (norm.includes(idN) || norm.includes(labelN) || labelN.includes(norm)) {
      return opt.id;
    }
  }

  // Synonym + token overlap scoring
  let best: { id: string; score: number } | null = null;
  for (const opt of options) {
    const score = scoreOption(opt, norm);
    if (score > 0 && (!best || score > best.score)) {
      best = { id: opt.id, score };
    }
  }
  if (best && best.score >= 3) return best.id;

  // Domain-specific free-form inference
  if (questionId === "urgency" || looksLikeUrgencyOptions(ids)) {
    const inferred = inferUrgency(norm, ids);
    if (inferred) return inferred;
  }
  if (questionId === "matter_type" || looksLikeMatterOptions(ids)) {
    const inferred = inferMatter(norm, ids);
    if (inferred) return inferred;
  }

  // Soft accept: any non-empty free-form → other / week / first option
  if (ids.has("other")) return "other";
  if (questionId === "urgency" && ids.has("week")) return "week";
  if (questionId === "urgency" && ids.has("flex")) return "flex";
  if (best) return best.id;

  // Last resort: accept first option rather than loop forever on demo
  return options[0]?.id ?? null;
}

function looksLikeUrgencyOptions(ids: Set<string>): boolean {
  return ids.has("48h") || ids.has("week") || ids.has("flex");
}

function looksLikeMatterOptions(ids: Set<string>): boolean {
  return ids.has("labor") || ids.has("corporate");
}

function scoreOption(
  opt: { id: string; label: string },
  norm: string,
): number {
  let score = 0;
  const labelN = normalize(opt.label);
  const tokens = new Set(norm.split(" ").filter((t) => t.length > 2));
  for (const t of labelN.split(" ").filter((x) => x.length > 2)) {
    if (tokens.has(t) || norm.includes(t)) score += t.length;
  }
  for (const w of SYNONYMS[opt.id] ?? []) {
    if (norm.includes(w)) score += w.length;
  }
  // fuzzy: shared prefix ≥ 4 chars with a label token
  for (const t of tokens) {
    for (const lt of labelN.split(" ")) {
      if (lt.length >= 4 && t.length >= 4 && (lt.startsWith(t) || t.startsWith(lt))) {
        score += 4;
      }
    }
  }
  return score;
}

function inferUrgency(norm: string, ids: Set<string>): string | null {
  const hours = norm.match(/\b(?:dans|sous)\s+(\d+)\s*h(?:eures?)?\b/);
  if (hours) {
    const h = Number(hours[1]);
    if (h <= 48 && ids.has("48h")) return "48h";
    if (h <= 168 && ids.has("week")) return "week";
    if (ids.has("flex")) return "flex";
  }

  const days = norm.match(
    /\b(?:dans|sous|d ici|avant|pour)\s+(\d+)\s*(?:j(?:ours?)?|jours?)\b/,
  );
  if (days) {
    const d = Number(days[1]);
    if (d <= 2 && ids.has("48h")) return "48h";
    if (d <= 7 && ids.has("week")) return "week";
    if (ids.has("flex")) return "flex";
    if (ids.has("week")) return "week";
  }

  if (
    ids.has("48h") &&
    /\b(urgent|urgence|demain|aujourd|ce soir|ce matin|rapid|asap|tout de suite|immediat|au plus vite)\b/.test(
      norm,
    )
  ) {
    return "48h";
  }

  if (
    ids.has("flex") &&
    /\b(flex|pas presse|sans urgence|plus tard|quand vous|ouvert|pas d urgence)\b/.test(
      norm,
    )
  ) {
    return "flex";
  }

  // Any calendar / relative deadline phrasing → week
  if (
    ids.has("week") &&
    (WEEKDAYS.test(norm) ||
      MONTHS.test(norm) ||
      /\b(d ici|pour|avant|vers|autour|fin de|debut|cette semaine|prochaine?|rdv|rendez vous)\b/.test(
        norm,
      ) ||
      /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(norm))
  ) {
    return "week";
  }

  // Free-form non-empty urgency: prefer week, then flex, then 48h
  if (ids.has("week")) return "week";
  if (ids.has("flex")) return "flex";
  if (ids.has("48h")) return "48h";
  return null;
}

function inferMatter(norm: string, ids: Set<string>): string | null {
  let labor = 0;
  let corporate = 0;
  for (const w of SYNONYMS.labor ?? []) {
    if (norm.includes(w)) labor += w.length;
  }
  for (const w of SYNONYMS.corporate ?? []) {
    if (norm.includes(w)) corporate += w.length;
  }
  if (labor > corporate && ids.has("labor")) return "labor";
  if (corporate > labor && ids.has("corporate")) return "corporate";
  if (labor > 0 && ids.has("labor")) return "labor";
  if (corporate > 0 && ids.has("corporate")) return "corporate";
  if (ids.has("other")) return "other";
  return null;
}
