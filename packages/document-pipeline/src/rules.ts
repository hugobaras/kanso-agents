import type { DocumentToActionConfig } from "@kanso/config";

export type RuleOutcome =
  | { ok: true }
  | { ok: false; severity: "anomaly" | "review"; reason: string; message: string; details?: Record<string, unknown> };

export type RuleContext = {
  documentType: string;
  fields: Record<string, unknown>;
  confidence: Record<string, number>;
  config: DocumentToActionConfig;
  knownIbans: string[];
  /** Business keys of earlier documents for duplicate detection. */
  existingKeys: Set<string>;
};

type Rule = DocumentToActionConfig["validation"]["rules"][number];
type RuleImpl = (rule: Rule, ctx: RuleContext) => RuleOutcome;

const CRITICAL: Record<string, string[]> = {
  invoice: ["vendor_name", "invoice_number", "total_ttc"],
  quote: ["vendor_name", "quote_number", "total_ttc"],
  delivery_note: ["vendor_name", "delivery_number"],
};

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export function duplicateKey(fields: Record<string, unknown>, keys: string[]): string | null {
  const parts = keys.map((k) => String(fields[k] ?? "").trim().toLowerCase());
  return parts.every(Boolean) ? parts.join("|") : null;
}

const RULES: Record<Rule["kind"], RuleImpl> = {
  confidence_min(rule, ctx) {
    const min = num(rule.params?.min) ?? ctx.config.alerts.human_review.min_confidence;
    const critical = CRITICAL[ctx.documentType] ?? [];
    // Confidence gates the fields that drive money and identity (not the vendor label).
    const base = critical.filter((f) => f !== "vendor_name");
    const checked = ctx.fields.iban ? [...base, "iban"] : base;
    const missing = critical.filter((f) => ctx.fields[f] === undefined || ctx.fields[f] === "" || ctx.fields[f] === null);
    if (missing.length) {
      return { ok: false, severity: "anomaly", reason: "missing_fields", message: `Champs introuvables : ${missing.join(", ")}`, details: { missing } };
    }
    const low = checked.filter((f) => (ctx.confidence[f] ?? 0) < min);
    if (low.length) {
      return {
        ok: false,
        severity: "anomaly",
        reason: "low_confidence",
        message: `Lecture incertaine : ${low.join(", ")}`,
        details: { fields: low, min },
      };
    }
    return { ok: true };
  },

  totals_coherent(rule, ctx) {
    const tol = num(rule.params?.tolerance_eur) ?? 0.05;
    const ht = num(ctx.fields.total_ht);
    const vat = num(ctx.fields.vat_amount);
    const ttc = num(ctx.fields.total_ttc);
    if (ht === null || vat === null || ttc === null) return { ok: true };
    if (Math.abs(ht + vat - ttc) > tol) {
      return {
        ok: false,
        severity: "anomaly",
        reason: "totals_incoherent",
        message: `HT + TVA (${(ht + vat).toFixed(2)}) ≠ TTC (${ttc.toFixed(2)})`,
        details: { ht, vat, ttc },
      };
    }
    return { ok: true };
  },

  iban_allowlist(_rule, ctx) {
    const iban = String(ctx.fields.iban ?? "").replace(/\s/g, "").toUpperCase();
    if (!iban || ctx.knownIbans.length === 0) return { ok: true };
    if (!ctx.knownIbans.map((i) => i.replace(/\s/g, "").toUpperCase()).includes(iban)) {
      return {
        ok: false,
        severity: "anomaly",
        reason: "iban_unknown",
        message: "IBAN inconnu pour ce fournisseur : vérifiez qu'il ne s'agit pas d'une fraude au changement de RIB.",
        details: { iban: `${iban.slice(0, 4)}…${iban.slice(-4)}` },
      };
    }
    return { ok: true };
  },

  duplicate_check(rule, ctx) {
    const keys = Array.isArray(rule.params?.keys) ? (rule.params!.keys as string[]) : ["vendor_name", "invoice_number"];
    const key = duplicateKey(ctx.fields, keys);
    const existing = new Set([...ctx.existingKeys].map((k) => k.trim().toLowerCase()));
    if (key && existing.has(key)) {
      return { ok: false, severity: "anomaly", reason: "duplicate", message: "Ce document semble déjà avoir été traité.", details: { keys } };
    }
    return { ok: true };
  },

  approval_threshold(rule, ctx) {
    const field = String(rule.params?.amount_field ?? "total_ttc");
    const max = num(rule.params?.max_auto_draft_eur);
    const amount = num(ctx.fields[field]);
    if (max !== null && amount !== null && amount > max) {
      return {
        ok: false,
        severity: "review",
        reason: "amount_above_threshold",
        message: `Montant supérieur au seuil de validation automatique (${max} €).`,
        details: { amount, max },
      };
    }
    return { ok: true };
  },
};

const PRIORITY: Rule["kind"][] = [
  "confidence_min",
  "totals_coherent",
  "iban_allowlist",
  "duplicate_check",
  "approval_threshold",
];

export type ValidationReport = {
  status: "ok" | "review" | "anomaly";
  reason: string | null;
  message: string | null;
  checks: Array<{ id: string; kind: string; ok: boolean; reason?: string; message?: string }>;
};

/** Run every configured rule; the first anomaly wins, review flags accumulate. */
export function runValidationRules(ctx: RuleContext): ValidationReport {
  const checks: ValidationReport["checks"] = [];
  let anomaly: Extract<RuleOutcome, { ok: false }> | null = null;
  let review: Extract<RuleOutcome, { ok: false }> | null = null;
  if (!ctx.config.documents.accepted_types.includes(ctx.documentType as never)) {
    return {
      status: "anomaly",
      reason: "unsupported_document_type",
      message: "Type de document non accepté par votre configuration.",
      checks: [],
    };
  }
  // Canonical priority, independent of the order rules are listed in config.
  const ordered = [...ctx.config.validation.rules].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  for (const rule of ordered) {
    const out = RULES[rule.kind](rule, ctx);
    checks.push(out.ok ? { id: rule.id, kind: rule.kind, ok: true } : { id: rule.id, kind: rule.kind, ok: false, reason: out.reason, message: out.message });
    if (!out.ok && out.severity === "anomaly" && !anomaly) anomaly = out;
    if (!out.ok && out.severity === "review" && !review) review = out;
  }
  if (anomaly) return { status: "anomaly", reason: anomaly.reason, message: anomaly.message, checks };
  if (review) return { status: "review", reason: review.reason, message: review.message, checks };
  return { status: "ok", reason: null, message: null, checks };
}
