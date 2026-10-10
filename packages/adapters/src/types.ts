import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";

export interface AlertAdapter {
  send(
    input: {
      channel: "email" | "slack";
      event: string;
      title: string;
      body: string;
      metadata: Record<string, string | number | boolean>;
    },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ delivered: true }>>;
}

export interface CrmAdapter {
  upsertLead(
    input: {
      externalKey: string;
      contact: { email?: string; phone?: string; name?: string };
      scoreFinal?: number;
      answers: Record<string, unknown>;
      source: "kanso_inbound";
    },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ recordId: string }>>;
}

export interface CalendarAdapter {
  listSlots(
    input: { from: string; to: string; timezone: string },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ slots: { start: string; end: string }[] }>>;

  bookSlot(
    input: {
      slotStart: string;
      slotEnd: string;
      attendeeEmail: string;
      title: string;
      idempotencyKey: string;
    },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ eventId: string }>>;
}

export interface DocumentSourceAdapter {
  poll(
    input: { cursor?: string },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<
    AdapterResult<{
      items: {
        sourceItemId: string;
        filename?: string;
        contentType: string;
        payloadRef: string;
        receivedAt: string;
      }[];
      nextCursor?: string;
    }>
  >;

  ack(
    input: { sourceItemId: string },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ acked: true }>>;
}

export interface AccountingTargetAdapter {
  createDraft(
    input: {
      documentType: "invoice" | "quote" | "delivery_note";
      fields: Record<string, unknown>;
      idempotencyKey: string;
      mode: "draft" | "final";
    },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ remoteId: string; mode: "draft" | "final" }>>;
}
