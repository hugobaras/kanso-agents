import { describe, expect, it } from "vitest";
import { buildDocumentTemplate } from "@kanso/config";
import { MockLlmClient } from "@kanso/llm";
import { buildInvoicePdf } from "./fixtures.js";
import { sniffMime } from "./file-type.js";
import { heuristicExtract } from "./heuristic-extract.js";
import { extractDocument, ingestDocument, validateDocument } from "./pipeline.js";
import { extractDocumentText } from "./text-extract.js";

describe("real extraction path", () => {
  it("reads the PDF text layer and extracts invoice fields offline", async () => {
    const pdf = buildInvoicePdf({ totalHt: 1250, number: "FA-2026-0142" });
    expect(sniffMime(pdf)).toBe("application/pdf");
    const { text, pages, method } = await extractDocumentText(pdf, "application/pdf");
    expect(method).toBe("pdf_text");
    expect(pages).toBe(1);
    expect(text).toContain("FA-2026-0142");

    const out = heuristicExtract(text);
    expect(out.document_type).toBe("invoice");
    expect(out.fields.invoice_number).toBe("FA-2026-0142");
    expect(out.fields.total_ht).toBe(1250);
    expect(out.fields.vat_amount).toBe(250);
    expect(out.fields.total_ttc).toBe(1500);
    expect(out.fields.iban).toBe("FR7630006000011234567890189");
  });

  it("passes the document text to the LLM (never a placeholder)", async () => {
    const seen: string[] = [];
    const llm = new MockLlmClient([{ document_type: "invoice", fields: {}, field_confidence: {} }]);
    const spy = {
      completeStructured: async (req: Parameters<typeof llm.completeStructured>[0]) => {
        seen.push(req.user, req.system);
        return llm.completeStructured(req);
      },
    };
    const job = ingestDocument({ jobId: "j", tenantId: "t", fileContent: Buffer.from("x") });
    await extractDocument(job, spy, { text: "Facture N° 42 Total TTC 120", config: buildDocumentTemplate() });
    expect(seen[0]).toContain("Facture N° 42");
    expect(seen[1]).toContain("total_ttc");
  });

  it("flags incoherent totals and amounts above the auto-approval threshold", async () => {
    const config = buildDocumentTemplate();
    const base = ingestDocument({ jobId: "j", tenantId: "t", fileContent: Buffer.from("x") });
    const conf = { invoice_number: 0.95, total_ttc: 0.95, vendor_name: 0.9 };
    const bad = await validateDocument(
      { ...base, documentType: "invoice", fields: { vendor_name: "A", invoice_number: "1", total_ht: 100, vat_amount: 20, total_ttc: 130 }, fieldConfidence: conf },
      config,
      { knownIbans: [] },
    );
    expect(bad.step).toBe("anomaly");
    expect(bad.anomalyReason).toBe("totals_incoherent");

    const big = await validateDocument(
      { ...base, documentType: "invoice", fields: { vendor_name: "A", invoice_number: "2", total_ht: 10000, vat_amount: 2000, total_ttc: 12000 }, fieldConfidence: conf },
      config,
      { knownIbans: [] },
    );
    expect(big.step).toBe("validate");
    expect(big.reviewReason).toBe("amount_above_threshold");
  });
});
