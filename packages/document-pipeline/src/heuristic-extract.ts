import type { ExtractLlmOutput } from "@kanso/llm";

/**
 * Offline extractor used when no LLM key is configured (dev, CI, demo).
 * Regex-based and deliberately conservative: low confidence on guesses so the
 * document lands in human review rather than producing a wrong draft.
 */

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s| /g, "").replace(/€|EUR/gi, "");
  // 1.234,56 → 1234.56 ; 1,234.56 → 1234.56 ; 1234,56 → 1234.56
  let normalised = cleaned;
  if (/,\d{1,2}$/.test(cleaned)) normalised = cleaned.replace(/\./g, "").replace(",", ".");
  else normalised = cleaned.replace(/,/g, "");
  const n = Number(normalised);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const AMOUNT = String.raw`(-?\d+(?:[ .\u00a0]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|EUR)?`;

function findAmount(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(`${label}[^\\d\\n-]{0,30}${AMOUNT}`, "i");
    const m = re.exec(text);
    if (m?.[1]) {
      const v = parseAmount(m[1]);
      if (v !== null) return v;
    }
  }
  return null;
}

function findDate(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${label}[^\\d\\n]{0,20}(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})`, "i");
    const m = re.exec(text);
    if (m) {
      const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
      return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    }
  }
  return null;
}

export function heuristicExtract(text: string): ExtractLlmOutput {
  const fields: Record<string, unknown> = {};
  const conf: Record<string, number> = {};
  const set = (k: string, v: unknown, c: number) => {
    if (v === null || v === undefined || v === "") return;
    fields[k] = v;
    conf[k] = c;
  };

  const isQuote = /\b(devis|quotation|proposition commerciale)\b/i.test(text) && !/\bfacture\b/i.test(text);
  const documentType = isQuote ? "quote" : "invoice";

  const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 2 && !/facture|devis|invoice/i.test(l));
  set("vendor_name", firstLine?.slice(0, 80), 0.6);

  const num = /(?:facture|invoice|devis)\s*(?:n[°o]|num[ée]ro|#)?\s*[:.]?\s*([A-Z0-9][A-Z0-9\-/_.]{2,30})/i.exec(text);
  // Explicit "Facture N° …" label → reasonably reliable.
  const labelled = !!num && /n[°o]|num[ée]ro/i.test(num[0]);
  set(isQuote ? "quote_number" : "invoice_number", num?.[1], labelled ? 0.88 : 0.7);

  set(isQuote ? "quote_date" : "invoice_date", findDate(text, ["date de facture", "date d'émission", "date", "le"]), 0.7);
  set("due_date", findDate(text, ["échéance", "a payer avant", "à payer avant", "date limite"]), 0.6);

  const ht = findAmount(text, ["total\\s*h\\.?t\\.?", "montant\\s*h\\.?t\\.?", "sous-total"]);
  const vat = findAmount(text, ["t\\.?v\\.?a\\.?(?:\\s*\\d+[.,]?\\d*\\s*%)?", "taxe"]);
  const ttc = findAmount(text, ["total\\s*t\\.?t\\.?c\\.?", "net\\s*à\\s*payer", "montant\\s*t\\.?t\\.?c\\.?", "total"]);
  set("total_ht", ht, 0.75);
  set("vat_amount", vat, 0.7);
  set("total_ttc", ttc, 0.8);
  if (ht !== null && vat !== null && ttc !== null && Math.abs(ht + vat - ttc) <= 0.05) {
    conf.total_ht = conf.vat_amount = conf.total_ttc = 0.9;
  }
  set("currency", /€|EUR/.test(text) ? "EUR" : null, 0.9);

  const iban = /\b(FR\d{2}(?:\s?[A-Z0-9]{4}){5}\s?[A-Z0-9]{3})\b/i.exec(text);
  set("iban", iban?.[1]?.replace(/\s/g, "").toUpperCase(), 0.85);

  const siret = /\bSIRET\s*:?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/i.exec(text);
  set("vendor_siret", siret?.[1]?.replace(/\s/g, ""), 0.85);

  return { document_type: documentType, fields, field_confidence: conf };
}
