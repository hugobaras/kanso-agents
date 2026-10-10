import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDocumentToActionConfig } from "@kanso/config";
import { MockLlmClient } from "@kanso/llm";
import { MockAlertAdapter, MockPennylaneAdapter } from "@kanso/adapters";
import { runDocumentHappyPath } from "./index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("document-to-action e2e mock", () => {
  it("extracts, validates, creates draft", async () => {
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
    const job = await runDocumentHappyPath({
      tenantId: "btp-leroy",
      config,
      fileContent: Buffer.from("%PDF-1.4 fixture"),
      llm,
      target,
      targetAuth: {
        provider: "pennylane",
        tenantId: "btp-leroy",
        credentials: { apiKey: "test" },
      },
      alerts,
      alertAuth: {
        provider: "slack",
        tenantId: "btp-leroy",
        credentials: { webhook: "https://example.invalid" },
      },
      knownIbans: ["FR7611111222223333444445555"],
    });

    expect(job.step).toBe("done");
    expect(job.remoteId).toBe("draft_job_e2e");
    expect(target.drafts).toHaveLength(1);
  });
});
