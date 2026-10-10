import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocumentToActionConfig } from "@kanso/config";
import { MockAlertAdapter, MockPennylaneAdapter } from "@kanso/adapters";
import { MockLlmClient } from "@kanso/llm";
import { runDocumentPipeline } from "@kanso/document-pipeline";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Un passage mock sandbox : extract → validate → draft Pennylane mock.
 * Remplacera le poll Postgres quand la file jobs sera branchée.
 */
export async function processOnceMock(opts?: {
  fileContent?: Buffer;
  knownIbans?: string[];
}) {
  const config = parseDocumentToActionConfig(
    JSON.parse(
      readFileSync(
        join(root, "config/examples/document_to_action.btp.example.json"),
        "utf8",
      ),
    ),
  );
  const llm = new MockLlmClient([
    {
      document_type: "invoice",
      fields: {
        vendor_name: "Fournisseur SAS",
        invoice_number: "F-2026-001",
        invoice_date: "2026-10-01",
        currency: "EUR",
        total_ht: 100,
        vat_amount: 20,
        total_ttc: 120,
        iban: "FR7611111222223333444445555",
        due_date: "2026-10-31",
      },
      field_confidence: {
        vendor_name: 0.95,
        invoice_number: 0.99,
        total_ht: 0.95,
        vat_amount: 0.95,
        total_ttc: 0.97,
        iban: 0.9,
      },
    },
  ]);
  const target = new MockPennylaneAdapter();
  const alerts = new MockAlertAdapter();
  const job = await runDocumentPipeline({
    tenantId: "btp-leroy",
    jobId: `job_${Date.now()}`,
    config,
    fileContent: opts?.fileContent ?? Buffer.from("%PDF-1.4 mock"),
    llm,
    target,
    targetAuth: {
      provider: "pennylane",
      tenantId: "btp-leroy",
      credentials: { apiKey: "mock" },
    },
    alerts,
    alertAuth: {
      provider: "slack",
      tenantId: "btp-leroy",
      credentials: {},
    },
    knownIbans: opts?.knownIbans ?? ["FR7611111222223333444445555"],
  });

  return {
    job,
    drafts: target.drafts.length,
    alerts: alerts.sent.length,
  };
}
