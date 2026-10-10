import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import { classifyHttpStatus, networkError } from "./http.js";
import type { CalendarAdapter } from "./types.js";

/**
 * Calendly (rang 2 agenda). Secret: `{ "access_token": "...", "event_type_uri": "..." }`.
 * Mapping listSlots/bookSlot = hypothèse H-018 — à valider sur compte réel.
 */
export class CalendlyAdapter implements CalendarAdapter {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://api.calendly.com",
  ) {}

  async listSlots(
    input: { from: string; to: string; timezone: string },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ slots: { start: string; end: string }[] }>> {
    const token = auth.credentials.access_token;
    const eventType = auth.credentials.event_type_uri;
    if (!token || !eventType) {
      return {
        status: "fatal",
        errorCode: "calendly_credentials",
        message: "access_token and event_type_uri required",
      };
    }
    try {
      const url = new URL(`${this.baseUrl}/event_type_available_times`);
      url.searchParams.set("event_type", eventType);
      url.searchParams.set("start_time", input.from);
      url.searchParams.set("end_time", input.to);
      const res = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as {
        collection?: { start_time?: string; invitees_remaining?: number }[];
      };
      const slots =
        json.collection
          ?.filter((s) => s.start_time)
          .map((s) => {
            const start = s.start_time!;
            const end = new Date(
              new Date(start).getTime() + 30 * 60_000,
            ).toISOString();
            return { start, end };
          }) ?? [];
      return { status: "ok", data: { slots } };
    } catch (err) {
      return networkError(err);
    }
  }

  async bookSlot(
    input: {
      slotStart: string;
      slotEnd: string;
      attendeeEmail: string;
      title: string;
      idempotencyKey: string;
    },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ eventId: string }>> {
    const token = auth.credentials.access_token;
    const eventType = auth.credentials.event_type_uri;
    if (!token || !eventType) {
      return {
        status: "fatal",
        errorCode: "calendly_credentials",
        message: "access_token and event_type_uri required",
      };
    }
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/invitees`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: eventType,
          start_time: input.slotStart,
          invitee: { email: input.attendeeEmail, name: input.title },
          tracking: { utm_content: input.idempotencyKey },
        }),
      });
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as {
        resource?: { uri?: string };
      };
      const eventId =
        json.resource?.uri?.split("/").pop() ?? input.idempotencyKey;
      return { status: "ok", data: { eventId }, providerRequestId: eventId };
    } catch (err) {
      return networkError(err);
    }
  }
}

export function createCalendlyAdapter(auth: AuthContext): CalendarAdapter {
  if (
    auth.credentials.access_token &&
    auth.credentials.event_type_uri &&
    auth.credentials.sandbox !== "true"
  ) {
    return new CalendlyAdapter();
  }
  // reuse mock calendar behavior inline
  return {
    async listSlots(input) {
      return {
        status: "ok",
        data: {
          slots: [
            {
              start: input.from,
              end: new Date(
                new Date(input.from).getTime() + 30 * 60_000,
              ).toISOString(),
            },
          ],
        },
      };
    },
    async bookSlot(input) {
      return {
        status: "ok",
        data: { eventId: `calendly_${input.idempotencyKey}` },
      };
    },
  };
}
