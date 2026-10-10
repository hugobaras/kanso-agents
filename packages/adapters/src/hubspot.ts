import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import { classifyHttpStatus, networkError } from "./http.js";
import type { CrmAdapter } from "./types.js";

/** HubSpot CRM — Contacts API v3. Secret: `{ "access_token": "pat-..." }`. */
export class HubSpotCrmAdapter implements CrmAdapter {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://api.hubapi.com",
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
        errorCode: "hubspot_credentials",
        message: "access_token required",
      };
    }
    if (!input.contact.email) {
      return {
        status: "fatal",
        errorCode: "hubspot_email_required",
        message: "contact.email required for upsert",
      };
    }

    try {
      const res = await this.fetchImpl(
        `${this.baseUrl}/crm/v3/objects/contacts/batch/upsert`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: [
              {
                idProperty: "email",
                id: input.contact.email,
                properties: {
                  email: input.contact.email,
                  phone: input.contact.phone ?? "",
                  firstname: input.contact.name ?? "",
                  kanso_external_key: input.externalKey,
                  kanso_score: String(input.scoreFinal ?? ""),
                  kanso_source: input.source,
                },
              },
            ],
          }),
        },
      );
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as {
        results?: { id?: string }[];
      };
      const recordId = json.results?.[0]?.id ?? input.externalKey;
      return { status: "ok", data: { recordId }, providerRequestId: recordId };
    } catch (err) {
      return networkError(err);
    }
  }
}

export class MockCrmAdapter implements CrmAdapter {
  readonly leads: Array<{ externalKey: string; email?: string }> = [];

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
    this.leads.push({
      externalKey: input.externalKey,
      email: input.contact.email,
    });
    return { status: "ok", data: { recordId: `mock_${input.externalKey}` } };
  }
}

export function createHubSpotCrmAdapter(auth: AuthContext): CrmAdapter {
  if (auth.credentials.access_token && auth.credentials.sandbox !== "true") {
    return new HubSpotCrmAdapter();
  }
  return new MockCrmAdapter();
}
