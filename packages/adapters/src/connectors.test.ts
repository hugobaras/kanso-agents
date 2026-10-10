import { describe, expect, it, vi } from "vitest";
import { createHubSpotCrmAdapter, HubSpotCrmAdapter } from "./hubspot.js";
import { createGoogleCalendarAdapter } from "./google-calendar.js";
import { createPennylaneAdapter, PennylaneAccountingAdapter } from "./pennylane.js";
import { EmailInboxSourceAdapter } from "./email-inbox.js";
import { createSellsyCrmAdapter } from "./sellsy.js";
import { createCalendlyAdapter } from "./calendly.js";
import {
  getAccountingAdapter,
  getCalendarAdapter,
  getCrmAdapter,
  getDocumentSourceAdapter,
} from "./registry.js";

const ctx = {
  tenantId: "t1",
  correlationId: "c1",
  configVersion: 1,
  attempt: 1,
};

describe("HubSpot", () => {
  it("sandbox without token → mock", async () => {
    const adapter = createHubSpotCrmAdapter({
      provider: "hubspot",
      tenantId: "t1",
      credentials: {},
    });
    const res = await adapter.upsertLead(
      {
        externalKey: "s1",
        contact: { email: "a@b.c" },
        answers: {},
        source: "kanso_inbound",
      },
      { provider: "hubspot", tenantId: "t1", credentials: {} },
      ctx,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.data.recordId).toMatch(/^mock_/);
  });

  it("HTTP upsert", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ results: [{ id: "hs-1" }] }),
    );
    const adapter = new HubSpotCrmAdapter(fetchImpl);
    const res = await adapter.upsertLead(
      {
        externalKey: "s1",
        contact: { email: "a@b.c" },
        answers: {},
        source: "kanso_inbound",
      },
      {
        provider: "hubspot",
        tenantId: "t1",
        credentials: { access_token: "pat" },
      },
      ctx,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.data.recordId).toBe("hs-1");
  });
});

describe("registry", () => {
  it("resolves providers", () => {
    const auth = {
      provider: "x",
      tenantId: "t1",
      credentials: { sandbox: "true" },
    };
    expect(getCrmAdapter("hubspot", auth)).toBeTruthy();
    expect(getCrmAdapter("sellsy", auth)).toBeTruthy();
    expect(getCalendarAdapter("google_calendar", auth)).toBeTruthy();
    expect(getCalendarAdapter("calendly", auth)).toBeTruthy();
    expect(getDocumentSourceAdapter("email_inbox")).toBeInstanceOf(
      EmailInboxSourceAdapter,
    );
    expect(getDocumentSourceAdapter("google_drive")).toBeTruthy();
    expect(getDocumentSourceAdapter("dropbox")).toBeTruthy();
    expect(getAccountingAdapter("pennylane", auth)).toBeTruthy();
    expect(getAccountingAdapter("sellsy_accounting", auth)).toBeTruthy();
  });
});

describe("email_inbox", () => {
  it("poll and ack", async () => {
    const src = new EmailInboxSourceAdapter([
      {
        sourceItemId: "m1",
        contentType: "application/pdf",
        payloadRef: "mem://m1",
        receivedAt: new Date().toISOString(),
      },
    ]);
    const auth = { provider: "email_inbox", tenantId: "t1", credentials: {} };
    const polled = await src.poll({}, auth, ctx);
    expect(polled.status).toBe("ok");
    if (polled.status === "ok") expect(polled.data.items).toHaveLength(1);
    const ack = await src.ack({ sourceItemId: "m1" }, auth, ctx);
    expect(ack.status).toBe("ok");
    const again = await src.poll({}, auth, ctx);
    if (again.status === "ok") expect(again.data.items).toHaveLength(0);
  });
});

describe("factories sandbox", () => {
  it("gcal / pennylane / sellsy / calendly mock without live creds", async () => {
    const auth = { provider: "x", tenantId: "t1", credentials: {} };
    const gcal = createGoogleCalendarAdapter(auth);
    const slots = await gcal.listSlots(
      {
        from: "2026-10-10T09:00:00Z",
        to: "2026-10-10T17:00:00Z",
        timezone: "Europe/Paris",
      },
      auth,
      ctx,
    );
    expect(slots.status).toBe("ok");

    const penny = createPennylaneAdapter(auth);
    const draft = await penny.createDraft(
      {
        documentType: "invoice",
        fields: { invoice_number: "1" },
        idempotencyKey: "k1",
        mode: "draft",
      },
      auth,
      ctx,
    );
    expect(draft.status).toBe("ok");

    const sellsy = createSellsyCrmAdapter(auth);
    const lead = await sellsy.upsertLead(
      {
        externalKey: "e1",
        contact: { email: "x@y.z" },
        answers: {},
        source: "kanso_inbound",
      },
      auth,
      ctx,
    );
    expect(lead.status).toBe("ok");

    const cal = createCalendlyAdapter(auth);
    const book = await cal.bookSlot(
      {
        slotStart: "2026-10-10T09:00:00Z",
        slotEnd: "2026-10-10T09:30:00Z",
        attendeeEmail: "a@b.c",
        title: "RDV",
        idempotencyKey: "i1",
      },
      auth,
      ctx,
    );
    expect(book.status).toBe("ok");
  });

  it("pennylane live path uses HTTP", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: 42 }));
    const adapter = new PennylaneAccountingAdapter(fetchImpl);
    const res = await adapter.createDraft(
      {
        documentType: "invoice",
        fields: { invoice_number: "F1", total_ttc: 10 },
        idempotencyKey: "idem",
        mode: "draft",
      },
      { provider: "pennylane", tenantId: "t1", credentials: { api_key: "k" } },
      ctx,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.data.remoteId).toBe("42");
  });
});
