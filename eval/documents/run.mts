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
const casesDir = join(root, "eval/documents/cases");
const reportsDir = join(root, "eval/documents/reports");

type DocCase = {
  id: string;
  family: string;
  config_ref: string;
  fixture: unknown;
  known_ibans: string[];
  expect: { step: string; anomaly_reason: string | null };
};

const results = [];
for (const file of readdirSync(casesDir).filter((f) => f.endsWith(".json")).sort()) {
  const c = JSON.parse(readFileSync(join(casesDir, file), "utf8")) as DocCase;
  const config = parseDocumentToActionConfig(
    JSON.parse(readFileSync(join(root, c.config_ref), "utf8")),
  );
  const llm = new MockLlmClient([c.fixture]);
  const target = new MockPennylaneAdapter();
  const alerts = new MockAlertAdapter();
  const job = await runDocumentPipeline({
    tenantId: "eval-d2a",
    jobId: c.id,
    config,
    fileContent: Buffer.from(`fixture-${c.id}`),
    llm,
    target,
    targetAuth: {
      provider: "pennylane",
      tenantId: "eval-d2a",
      credentials: { apiKey: "mock" },
    },
    alerts,
    alertAuth: {
      provider: "slack",
      tenantId: "eval-d2a",
      credentials: {},
    },
    knownIbans: c.known_ibans,
  });

  const failures: string[] = [];
  if (job.step !== c.expect.step) {
    failures.push(`step: got ${job.step}, want ${c.expect.step}`);
  }
  const anom = job.anomalyReason ?? null;
  if (anom !== c.expect.anomaly_reason) {
    failures.push(`anomaly: got ${anom}, want ${c.expect.anomaly_reason}`);
  }
  results.push({
    id: c.id,
    family: c.family,
    pass: failures.length === 0,
    failures,
    observed: { step: job.step, anomaly_reason: anom },
  });
}

const passed = results.filter((r) => r.pass).length;
const anomalyExpected = results.filter((r) => r.family !== "happy_invoice");
const anomalyOk = anomalyExpected.filter((r) => r.pass).length;
const report = {
  at: new Date().toISOString(),
  mode: "mock",
  total: results.length,
  passed,
  failed: results.length - passed,
  metrics: {
    case_pass_rate: results.length ? passed / results.length : 0,
    anomaly_cases_ok: anomalyExpected.length
      ? anomalyOk / anomalyExpected.length
      : 1,
    note: "Échantillon protocole ; corpus 100 = pnpm eval:corpus",
  },
  results,
};

mkdirSync(reportsDir, { recursive: true });
const out = join(
  reportsDir,
  `${new Date().toISOString().replace(/[:.]/g, "-")}-mock.json`,
);
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      ok: passed === results.length,
      passed,
      failed: results.length - passed,
      metrics: report.metrics,
      report: out,
    },
    null,
    2,
  ),
);
process.exit(passed === results.length ? 0 : 1);
