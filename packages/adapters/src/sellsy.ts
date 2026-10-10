import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import { classifyHttpStatus, networkError } from "./http.js";
import type { AccountingTargetAdapter, CrmAdapter } from "./types.js";

/**
 * Sellsy CRM (rang 2). Secret: `{ "access_token": "..." }` ou sandbox.
 * Credentials séparés de la cible compta Sellsy.
 */
export class SellsyCrmAdapter implements CrmAdapter {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://api.sellsy.com/v2",
  ) {}

  async upsertLead(
    input: {
      externalKey: string;
      contact: { email?: string; phone?: string; name?: string };
      scoreFinal?: number;
      answers: Record<string, unknown>;
      source: "kanso_inbound";
    },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ recordId: string }>> {
    const token = auth.credentials.access_token;
    if (!token) {
      return {
        status: "fatal",
        errorCode: "sellsy_credentials",
        message: "access_token required",
      };
    }
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: input.contact.email,
          phone_number: input.contact.phone,
          name: input.contact.name,
          note: `kanso:${input.externalKey} score=${input.scoreFinal ?? ""}`,
        }),
      });
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as { id?: string | number };
      const recordId = String(json.id ?? input.externalKey);
      return { status: "ok", data: { recordId }, providerRequestId: recordId };
    } catch (err) {
      return networkError(err);
    }
  }
}

/** Sellsy facturation — credentials distincts (`provider: sellsy_accounting`). */
export class SellsyAccountingAdapter implements AccountingTargetAdapter {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://api.sellsy.com/v2",
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
    const token = auth.credentials.access_token;
    if (!token) {
      return {
        status: "fatal",
        errorCode: "sellsy_credentials",
        message: "access_token required",
      };
    }
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/invoices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          number: input.fields.invoice_number,
          date: input.fields.invoice_date,
          currency: input.fields.currency ?? "EUR",
          status: input.mode === "draft" ? "draft" : "due",
          related: { kanso_key: input.idempotencyKey, kanso_mode: input.mode },
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

class MockSellsyCrmAdapter implements CrmAdapter {
  readonly leads: Array<{ externalKey: string }> = [];

  async upsertLead(
    input: {
      externalKey: string;
      contact: { email?: string; phone?: string; name?: string };
      scoreFinal?: number;
      answers: Record<string, unknown>;
      source: "kanso_inbound";
    },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ recordId: string }>> {
    this.leads.push({ externalKey: input.externalKey });
    return { status: "ok", data: { recordId: `sellsy_${input.externalKey}` } };
  }
}

export function createSellsyCrmAdapter(auth: AuthContext): CrmAdapter {
  if (auth.credentials.access_token && auth.credentials.sandbox !== "true") {
    return new SellsyCrmAdapter();
  }
  return new MockSellsyCrmAdapter();
}

export function createSellsyAccountingAdapter(
  auth: AuthContext,
): AccountingTargetAdapter {
  if (auth.credentials.access_token && auth.credentials.sandbox !== "true") {
    return new SellsyAccountingAdapter();
  }
  return {
    async createDraft(input) {
      return {
        status: "ok",
        data: {
          remoteId: `sellsy_draft_${input.idempotencyKey}`,
          mode: input.mode,
        },
      };
    },
  };
}
