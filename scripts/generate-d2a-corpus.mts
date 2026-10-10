import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const labelsDir = join(root, "eval/documents/corpus/labels");
mkdirSync(labelsDir, { recursive: true });

const KNOWN_IBAN = "FR7611111222223333444445555";
const BAD_IBAN = "FR7699999888887777666665555";

type Outcome =
  | "draft"
  | "anomaly_low_confidence"
  | "anomaly_validation"
  | "anomaly_duplicate"
  | "anomaly_iban";

type Label = {
  id: string;
  lot: "A";
  document_type: "invoice" | "quote" | "delivery_note";
  fields: Record<string, unknown>;
  field_confidence: Record<string, number>;
  critical_fields: string[];
  expected_outcome: Outcome;
  known_ibans: string[];
  existing_keys?: string[];
  notes: string;
};

const labels: Label[] = [];

function invoiceFields(n: number, opts?: { ttc?: number; iban?: string }) {
  const ht = 100 + (n % 50);
  const vat = Math.round(ht * 0.2 * 100) / 100;
  const ttc = opts?.ttc ?? Math.round((ht + vat) * 100) / 100;
  return {
    vendor_name: `Fournisseur Fictif ${n % 17}`,
    invoice_number: `SYN-2026-${String(n).padStart(4, "0")}`,
    invoice_date: "2026-10-01",
    currency: "EUR",
    total_ht: ht,
    vat_amount: vat,
    total_ttc: ttc,
    iban: opts?.iban ?? KNOWN_IBAN,
    due_date: "2026-10-31",
  };
}

function highConf(fields: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(fields)) out[k] = 0.95;
  out.invoice_number = 0.99;
  out.total_ttc = 0.97;
  out.iban = 0.92;
  return out;
}

// 85 draft
for (let i = 1; i <= 85; i++) {
  const fields = invoiceFields(i);
  labels.push({
    id: `syn-${String(i).padStart(3, "0")}`,
    lot: "A",
    document_type: "invoice",
    fields,
    field_confidence: highConf(fields),
    critical_fields: ["invoice_number", "total_ttc", "iban"],
    expected_outcome: "draft",
    known_ibans: [KNOWN_IBAN],
    notes: "synthétique anonymisé lot A",
  });
}

// 5 low confidence
for (let i = 86; i <= 90; i++) {
  const fields = invoiceFields(i);
  const conf = highConf(fields);
  conf.invoice_number = 0.4;
  labels.push({
    id: `syn-${String(i).padStart(3, "0")}`,
    lot: "A",
    document_type: "invoice",
    fields,
    field_confidence: conf,
    critical_fields: ["invoice_number", "total_ttc", "iban"],
    expected_outcome: "anomaly_low_confidence",
    known_ibans: [KNOWN_IBAN],
    notes: "anomalie attendue: low confidence",
  });
}

// 5 totals incoherent
for (let i = 91; i <= 95; i++) {
  const fields = invoiceFields(i, { ttc: 9999 });
  labels.push({
    id: `syn-${String(i).padStart(3, "0")}`,
    lot: "A",
    document_type: "invoice",
    fields,
    field_confidence: highConf(fields),
    critical_fields: ["invoice_number", "total_ttc", "iban"],
    expected_outcome: "anomaly_validation",
    known_ibans: [KNOWN_IBAN],
    notes: "anomalie attendue: totals",
  });
}

// 3 iban unknown
for (let i = 96; i <= 98; i++) {
  const fields = invoiceFields(i, { iban: BAD_IBAN });
  labels.push({
    id: `syn-${String(i).padStart(3, "0")}`,
    lot: "A",
    document_type: "invoice",
    fields,
    field_confidence: highConf(fields),
    critical_fields: ["invoice_number", "total_ttc", "iban"],
    expected_outcome: "anomaly_iban",
    known_ibans: [KNOWN_IBAN],
    notes: "anomalie attendue: iban",
  });
}

// 2 duplicates (same vendor+number as syn-001 / syn-002)
for (const [i, base] of [
  [99, 1],
  [100, 2],
] as const) {
  const fields = invoiceFields(base);
  labels.push({
    id: `syn-${String(i).padStart(3, "0")}`,
    lot: "A",
    document_type: "invoice",
    fields,
    field_confidence: highConf(fields),
    critical_fields: ["invoice_number", "total_ttc", "iban"],
    expected_outcome: "anomaly_duplicate",
    known_ibans: [KNOWN_IBAN],
    existing_keys: [`${fields.vendor_name}|${fields.invoice_number}`],
    notes: "anomalie attendue: duplicate",
  });
}

if (labels.length !== 100) throw new Error(`expected 100, got ${labels.length}`);

const manifest: string[] = [];
for (const label of labels) {
  writeFileSync(
    join(labelsDir, `${label.id}.json`),
    JSON.stringify(label, null, 2) + "\n",
  );
  manifest.push(
    JSON.stringify({
      id: label.id,
      lot: label.lot,
      document_type: label.document_type,
      expected_outcome: label.expected_outcome,
      labels_path: `labels/${label.id}.json`,
    }),
  );
}
writeFileSync(
  join(root, "eval/documents/corpus/manifest.jsonl"),
  manifest.join("\n") + "\n",
);
console.log(`wrote ${labels.length} labels + manifest`);
