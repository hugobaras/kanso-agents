import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import { classifyHttpStatus, networkError } from "./http.js";
import type { AccountingTargetAdapter } from "./types.js";

/**
 * Pennylane — création brouillon (hypothèse endpoint supplier invoices).
 * Secret: `{ "api_key": "..." }` ; `sandbox=true` → mock.
 * *À recalibrer* sur la doc OpenAPI Pennylane du compte client.
 */
export class PennylaneAccountingAdapter implements AccountingTargetAdapter {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://app.pennylane.com/api/external/v2",
  ) {}

  async createDraft(
    input: {
      documentType: "invoice" | "quote" | "delivery_note";
      fields: Record<string, unknown>;
      idempotencyKey: string;
      mode: "draft" | "final";
    },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ remoteId: string; mode: "draft" | "final" }>> {
    const apiKey = auth.credentials.api_key;
    if (!apiKey) {
      return {
        status: "fatal",
        errorCode: "pennylane_credentials",
        message: "api_key required",
      };
    }
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/supplier_invoices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          invoice_number: input.fields.invoice_number,
          date: input.fields.invoice_date,
          currency: input.fields.currency ?? "EUR",
          amount: input.fields.total_ttc,
          label: input.fields.vendor_name,
          draft: input.mode === "draft",
          kanso_document_type: input.documentType,
          kanso_mode: input.mode,
        }),
      });
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as { id?: string | number };
      const remoteId = String(json.id ?? input.idempotencyKey);
      return {
        status: "ok",
        data: { remoteId, mode: "draft" },
        providerRequestId: remoteId,
      };
    } catch (err) {
      return networkError(err);
    }
  }
}

export class MockPennylaneAdapter implements AccountingTargetAdapter {
  readonly drafts: Array<{
    idempotencyKey: string;
    fields: Record<string, unknown>;
  }> = [];

  async createDraft(
    input: {
      documentType: "invoice" | "quote" | "delivery_note";
      fields: Record<string, unknown>;
      idempotencyKey: string;
      mode: "draft" | "final";
    },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ remoteId: string; mode: "draft" | "final" }>> {
    this.drafts.push({
      idempotencyKey: input.idempotencyKey,
      fields: input.fields,
    });
    return {
      status: "ok",
      data: { remoteId: `draft_${input.idempotencyKey}`, mode: input.mode },
    };
  }
}

export function createPennylaneAdapter(
  auth: AuthContext,
): AccountingTargetAdapter {
  if (auth.credentials.api_key && auth.credentials.sandbox !== "true") {
    return new PennylaneAccountingAdapter();
  }
  return new MockPennylaneAdapter();
}
