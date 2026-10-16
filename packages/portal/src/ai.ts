import { decryptFile, encryptFile, fileAad } from "./crypto.js";

/**
 * Analyse IA des pièces du Portail : toujours limitée à UN dossier, jamais
 * d'action automatique, réponses citées (pièce + page) ou « non trouvé ».
 */

/** Version de l'avenant DPA « Analyse IA » : la changer désactive l'IA jusqu'à nouvelle acceptation. */
export const AI_TERMS_VERSION = "2026-10-ia-v1";

/** Mistral seulement si explicitement demandé (avenant + non-conservation obtenus) ; sinon simulation locale. */
export function portailAiMode(env: NodeJS.ProcessEnv = process.env): "mistral" | "simulated" {
  return env.KANSO_PORTAIL_AI_MODE === "mistral" && !!env.MISTRAL_API_KEY ? "mistral" : "simulated";
}

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

// ---- Analyse ------------------------------------------------------------------------------

export type AiDoc = { file_id: string; item_label: string; filename: string; pages: PageTexts };
export type AiItem = { label: string; required: boolean; has_file: boolean };
export type Citation = { file_id: string; page: number; quote?: string };

export type SummaryResult = {
  overview: string;
  pieces: Array<{ file_id: string; item_label: string; type: string; parties: string[]; dates: string[]; amounts: string[]; citations: Citation[] }>;
};
export type CheckResult = { findings: Array<{ item_label: string; severity: "info" | "warning"; message: string; citations: Citation[] }> };
export type AskResult = { found: boolean; answer: string; citations: Citation[] };

export interface PortailAnalyst {
  summarize(docs: AiDoc[]): Promise<SummaryResult>;
  check(items: AiItem[], docs: AiDoc[]): Promise<CheckResult>;
  ask(question: string, docs: AiDoc[]): Promise<AskResult>;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Garde-fou anti-hallucination : une citation doit désigner une pièce et une page
 * réellement fournies, et un extrait cité doit figurer sur cette page (sinon il est retiré).
 */
export function validCitations(citations: Citation[] | undefined, docs: AiDoc[]): Citation[] {
  const out: Citation[] = [];
  for (const c of citations ?? []) {
    const doc = docs.find((d) => d.file_id === c.file_id);
    const page = doc?.pages[c.page - 1];
    if (page === undefined) continue;
    const quote = c.quote && norm(page).includes(norm(c.quote)) ? c.quote : undefined;
    out.push({ file_id: c.file_id, page: c.page, ...(quote ? { quote } : {}) });
  }
  return out;
}

export function sanitizeSummary(r: SummaryResult, docs: AiDoc[]): SummaryResult {
  return {
    overview: r.overview,
    pieces: r.pieces.filter((p) => docs.some((d) => d.file_id === p.file_id)).map((p) => ({ ...p, citations: validCitations(p.citations, docs) })),
  };
}

export function sanitizeCheck(r: CheckResult, docs: AiDoc[]): CheckResult {
  return { findings: r.findings.map((f) => ({ ...f, citations: validCitations(f.citations, docs) })) };
}

/** Une réponse sans citation valide n'est jamais présentée comme trouvée. */
export function sanitizeAnswer(r: AskResult, docs: AiDoc[]): AskResult {
  const citations = validCitations(r.citations, docs);
  if (!r.found || citations.length === 0) return { found: false, answer: NOT_FOUND, citations: [] };
  return { found: true, answer: r.answer, citations };
}

export const NOT_FOUND = "Je ne trouve pas cette information dans les pièces analysées.";

const TYPES: Array<[string, RegExp]> = [
  ["Pièce d'identité", /carte nationale d'identite|passeport|titre de sejour|\bcni\b/],
  ["Avis d'imposition", /avis d'imposition|impot sur le revenu|revenu fiscal de reference/],
  ["Bulletin de salaire", /bulletin de (salaire|paie)|salaire brut|net a payer/],
  ["Relevé bancaire", /releve de compte|releve bancaire|solde (crediteur|debiteur|au)/],
  ["Facture", /\bfacture\b/],
  ["Justificatif de domicile", /justificatif de domicile|quittance de loyer|facture d'(electricite|eau|energie)/],
  ["Contrat", /\bcontrat\b|\bbail\b/],
  ["Extrait Kbis / statuts", /kbis|statuts de la societe|registre du commerce/],
  ["Certificat médical", /certificat medical|ordonnance|compte rendu medical/],
];

export function detectType(text: string): string | null {
  const t = norm(text);
  return TYPES.find(([, re]) => re.test(t))?.[0] ?? null;
}

const DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;
const AMOUNT_RE = /\b\d{1,3}(?:[ . ]\d{3})*,\d{2} ?€/g;

/**
 * Analyste de simulation : déterministe, sans appel externe, utilisé tant que
 * l'avenant DPA et la non-conservation Mistral ne sont pas en place.
 */
export class HeuristicPortailAnalyst implements PortailAnalyst {
  constructor(private readonly today = new Date()) {}

  async summarize(docs: AiDoc[]): Promise<SummaryResult> {
    return {
      overview: `${docs.length} pièce${docs.length > 1 ? "s" : ""} analysée${docs.length > 1 ? "s" : ""}.`,
      pieces: docs.map((d) => {
        const text = d.pages.join("\n");
        const first = d.pages.findIndex((p) => p.trim());
        const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
        return {
          file_id: d.file_id,
          item_label: d.item_label,
          type: detectType(text) ?? "Type non reconnu",
          parties: firstLine ? [firstLine.slice(0, 80)] : [],
          dates: [...new Set(text.match(DATE_RE) ?? [])].slice(0, 5),
          amounts: [...new Set(text.match(AMOUNT_RE) ?? [])].slice(0, 5),
          citations: first >= 0 ? [{ file_id: d.file_id, page: first + 1 }] : [],
        };
      }),
    };
  }

  async check(items: AiItem[], docs: AiDoc[]): Promise<CheckResult> {
    const findings: CheckResult["findings"] = [];
    for (const it of items) {
      if (it.required && !it.has_file) findings.push({ item_label: it.label, severity: "info", message: "Aucune pièce reçue pour le moment.", citations: [] });
    }
    for (const d of docs) {
      const text = d.pages.join("\n");
      if (!text.trim()) {
        findings.push({ item_label: d.item_label, severity: "info", message: `${d.filename} : texte non lisible, vérification manuelle nécessaire.`, citations: [] });
        continue;
      }
      const expected = detectType(d.item_label);
      const got = detectType(text);
      if (expected && got && expected !== got) {
        findings.push({
          item_label: d.item_label,
          severity: "warning",
          message: `Pièce attendue : ${expected.toLowerCase()} ; le fichier ${d.filename} ressemble à : ${got.toLowerCase()}.`,
          citations: [{ file_id: d.file_id, page: 1 }],
        });
      }
      d.pages.forEach((p, i) => {
        const m = /(?:valable jusqu'au|date d'expiration|expire le|fin de validite)\D{0,20}(\d{2})\/(\d{2})\/(\d{4})/.exec(norm(p));
        if (!m) return;
        const until = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        if (until.getTime() < this.today.getTime()) {
          findings.push({
            item_label: d.item_label,
            severity: "warning",
            message: `${d.filename} : document expiré le ${m[1]}/${m[2]}/${m[3]}.`,
            citations: [{ file_id: d.file_id, page: i + 1 }],
          });
        }
      });
    }
    return { findings };
  }

  async ask(question: string, docs: AiDoc[]): Promise<AskResult> {
    const STOP = new Set(["les", "des", "une", "est", "quel", "quelle", "quels", "quelles", "dans", "pour", "par", "sur", "avec", "qui", "que", "quoi", "son", "sa", "ses", "leur", "client", "dossier", "piece", "pieces"]);
    const terms = norm(question).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
    if (!terms.length) return { found: false, answer: NOT_FOUND, citations: [] };
    let best: { score: number; doc: AiDoc; page: number; line: string } | null = null;
    for (const d of docs) {
      d.pages.forEach((p, i) => {
        for (const line of p.split("\n")) {
          const l = norm(line);
          const score = terms.filter((t) => l.includes(t)).length;
          if (score > 0 && (!best || score > best.score)) best = { score, doc: d, page: i + 1, line: line.trim() };
        }
      });
    }
    const hit = best as { score: number; doc: AiDoc; page: number; line: string } | null;
    if (!hit || hit.score < Math.min(2, terms.length)) return { found: false, answer: NOT_FOUND, citations: [] };
    const quote = hit.line.slice(0, 300);
    return { found: true, answer: `D'après ${hit.doc.filename} (page ${hit.page}) : « ${quote} »`, citations: [{ file_id: hit.doc.file_id, page: hit.page, quote }] };
  }
}
