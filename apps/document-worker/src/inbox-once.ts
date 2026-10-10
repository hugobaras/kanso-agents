import {
  EmailInboxSourceAdapter,
  createPennylaneAdapter,
  MockAlertAdapter,
} from "@kanso/adapters";
import { parseDocumentToActionConfig } from "@kanso/config";
import { runDocumentPipeline } from "@kanso/document-pipeline";
import { MockLlmClient } from "@kanso/llm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Poll email_inbox (file mémoire) → pipeline draft Pennylane (sandbox).
 */
export async function processInboxOnce() {
  const inbox = new EmailInboxSourceAdapter([
    {
      sourceItemId: "mail-demo-1",
      filename: "facture.pdf",
      contentType: "application/pdf",
      payloadRef: "mem://mail-demo-1",
      receivedAt: new Date().toISOString(),
    },
  ]);
  const auth = {
    provider: "email_inbox",
    tenantId: "btp-leroy",
    credentials: {},
  };
  const ctx = {
    tenantId: "btp-leroy",
    correlationId: "inbox-once",
    configVersion: 1,
    attempt: 1,
  };
  const polled = await inbox.poll({}, auth, ctx);
  if (polled.status !== "ok" || polled.data.items.length === 0) {
    return { processed: 0 };
  }

  const config = parseDocumentToActionConfig(
    JSON.parse(
      readFileSync(
        join(root, "config/examples/document_to_action.btp.example.json"),
        "utf8",
      ),
    ),
  );
  const item = polled.data.items[0]!;
  const llm = new MockLlmClient([
    {
      document_type: "invoice",
      fields: {
        vendor_name: "Fournisseur Inbox",
        invoice_number: "INB-1",
        invoice_date: "2026-10-01",
        currency: "EUR",
        total_ht: 50,
        vat_amount: 10,
        total_ttc: 60,
        iban: "FR7611111222223333444445555",
      },
      field_confidence: {
        invoice_number: 0.99,
        total_ttc: 0.97,
        iban: 0.9,
      },
    },
  ]);
  const target = createPennylaneAdapter({
    provider: "pennylane",
    tenantId: "btp-leroy",
    credentials: { sandbox: "true" },
  });
  const job = await runDocumentPipeline({
    tenantId: "btp-leroy",
    jobId: item.sourceItemId,
    config,
    fileContent: Buffer.from(`pdf:${item.payloadRef}`),
    llm,
    target,
    targetAuth: {
      provider: "pennylane",
      tenantId: "btp-leroy",
      credentials: { sandbox: "true" },
    },
    alerts: new MockAlertAdapter(),
    alertAuth: {
      provider: "slack",
      tenantId: "btp-leroy",
      credentials: {},
    },
    knownIbans: ["FR7611111222223333444445555"],
  });
  await inbox.ack({ sourceItemId: item.sourceItemId }, auth, ctx);
  return {
    processed: 1,
    step: job.step,
    remoteId: job.remoteId,
    sourceItemId: item.sourceItemId,
  };
}
