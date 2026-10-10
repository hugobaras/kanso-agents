import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocumentToActionConfig } from "../../packages/config/src/index.ts";
import { MockLlmClient } from "../../packages/llm/src/index.ts";
import {
  MockAlertAdapter,
  MockPennylaneAdapter,
} from "../../packages/adapters/src/index.ts";
import { runDocumentPipeline } from "../../packages/document-pipeline/src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const labelsDir = join(root, "eval/documents/corpus/labels");
const reportsDir = join(root, "eval/documents/reports");
const configPath = join(
  root,
  "config/examples/document_to_action.btp.example.json",
);

type Label = {
  id: string;
  document_type: "invoice" | "quote" | "delivery_note";
  fields: Record<string, unknown>;
  field_confidence: Record<string, number>;
  critical_fields: string[];
  expected_outcome: string;
  known_ibans: string[];
  existing_keys?: string[];
};

function expectFromOutcome(outcome: string): {
  step: string;
  anomaly: string | null;
} {
  switch (outcome) {
    case "draft":
      return { step: "done", anomaly: null };
    case "anomaly_low_confidence":
      return { step: "anomaly", anomaly: "low_confidence" };
    case "anomaly_validation":
      return { step: "anomaly", anomaly: "totals_incoherent" };
    case "anomaly_iban":
      return { step: "anomaly", anomaly: "iban_unknown" };
    case "anomaly_duplicate":
      return { step: "anomaly", anomaly: "duplicate" };
    default:
      return { step: "done", anomaly: null };
  }
}

function fieldMatch(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 0.005;
  }
  return (
    String(a ?? "")
      .trim()
      .toLowerCase() ===
    String(b ?? "")
      .trim()
      .toLowerCase()
  );
}

const config = parseDocumentToActionConfig(
  JSON.parse(readFileSync(configPath, "utf8")),
);
const files = readdirSync(labelsDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

let criticalTotal = 0;
let criticalOk = 0;
let anomalyJobs = 0;
let anomalyJustified = 0;
let draftDestined = 0;
let draftOk = 0;
let dupGold = 0;
let dupFound = 0;

const results = [];

for (const file of files) {
  const label = JSON.parse(
    readFileSync(join(labelsDir, file), "utf8"),
  ) as Label;
  const expect = expectFromOutcome(label.expected_outcome);
  const llm = new MockLlmClient([
    {
      document_type: label.document_type,
      fields: label.fields,
      field_confidence: label.field_confidence,
    },
  ]);
  const target = new MockPennylaneAdapter();
  const alerts = new MockAlertAdapter();
  const job = await runDocumentPipeline({
    tenantId: "corpus-a",
    jobId: label.id,
    config,
    fileContent: Buffer.from(`synthetic:${label.id}`),
    llm,
    target,
    targetAuth: {
      provider: "pennylane",
      tenantId: "corpus-a",
      credentials: { sandbox: "true" },
    },
    alerts,
    alertAuth: {
      provider: "slack",
      tenantId: "corpus-a",
      credentials: {},
    },
    knownIbans: label.known_ibans,
    existingKeys: new Set(label.existing_keys ?? []),
  });

  for (const field of label.critical_fields) {
    criticalTotal += 1;
    if (fieldMatch(job.fields[field], label.fields[field])) criticalOk += 1;
  }

  if (job.step === "anomaly") {
    anomalyJobs += 1;
    if (job.anomalyReason === expect.anomaly) anomalyJustified += 1;
  }

  if (label.expected_outcome === "draft") {
    draftDestined += 1;
    if (job.step === "done" && job.remoteId) draftOk += 1;
  }

  if (label.expected_outcome === "anomaly_duplicate") {
    dupGold += 1;
    if (job.anomalyReason === "duplicate") dupFound += 1;
  }

  const failures: string[] = [];
  if (job.step !== expect.step) {
    failures.push(`step: got ${job.step}, want ${expect.step}`);
  }
  if ((job.anomalyReason ?? null) !== expect.anomaly) {
    failures.push(
      `anomaly: got ${job.anomalyReason ?? null}, want ${expect.anomaly}`,
    );
  }

  results.push({
    id: label.id,
    expected_outcome: label.expected_outcome,
    pass: failures.length === 0,
    failures,
    observed: { step: job.step, anomaly_reason: job.anomalyReason ?? null },
  });
}

const passed = results.filter((r) => r.pass).length;
const metrics = {
  corpus_size: results.length,
  case_pass_rate: results.length ? passed / results.length : 0,
  critical_field_accuracy: criticalTotal ? criticalOk / criticalTotal : 0,
  anomaly_rate: results.length ? anomalyJobs / results.length : 0,
  anomaly_precision: anomalyJobs ? anomalyJustified / anomalyJobs : 1,
  duplicate_recall: dupGold ? dupFound / dupGold : 1,
  draft_write_success: draftDestined ? draftOk / draftDestined : 1,
  cost_per_document_eur: 0,
};

const thresholds = {
  critical_field_accuracy: metrics.critical_field_accuracy >= 0.85,
  anomaly_rate: metrics.anomaly_rate <= 0.15,
  draft_write_success: metrics.draft_write_success >= 0.95,
  corpus_size: metrics.corpus_size >= 100,
  case_pass_rate: metrics.case_pass_rate >= 0.9,
};

const go = Object.values(thresholds).every(Boolean);
const report = {
  at: new Date().toISOString(),
  mode: "mock_corpus",
  go_nogo: go ? "GO" : "NO_GO",
  thresholds,
  metrics,
  passed,
  failed: results.length - passed,
  results,
};

mkdirSync(reportsDir, { recursive: true });
const out = join(
  reportsDir,
  `${new Date().toISOString().replace(/[:.]/g, "-")}-corpus.json`,
);
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      ok: go && passed === results.length,
      go_nogo: report.go_nogo,
      metrics,
      thresholds,
      report: out,
    },
    null,
    2,
  ),
);
process.exit(go && passed === results.length ? 0 : 1);
