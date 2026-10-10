import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import { classifyHttpStatus, networkError } from "./http.js";
import type { CalendarAdapter } from "./types.js";

/**
 * Google Calendar API.
 * Secret: `{ "access_token": "...", "calendar_id": "primary" }` (OAuth token pré-résolu).
 */
export class GoogleCalendarAdapter implements CalendarAdapter {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://www.googleapis.com/calendar/v3",
  ) {}

  async listSlots(
    input: { from: string; to: string; timezone: string },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ slots: { start: string; end: string }[] }>> {
    const token = auth.credentials.access_token;
    const calendarId = encodeURIComponent(
      auth.credentials.calendar_id ?? "primary",
    );
    if (!token) {
      return {
        status: "fatal",
        errorCode: "gcal_credentials",
        message: "access_token required",
      };
    }
    try {
      const url = new URL(
        `${this.baseUrl}/calendars/${calendarId}/events`,
      );
      url.searchParams.set("timeMin", input.from);
      url.searchParams.set("timeMax", input.to);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("timeZone", input.timezone);
      const res = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      // Free/busy simplification: expose busy windows as inverse hint — MVP returns empty free slots if busy unknown
      const json = (await res.json()) as {
        items?: { start?: { dateTime?: string }; end?: { dateTime?: string } }[];
      };
      const slots =
        json.items
          ?.filter((e) => e.start?.dateTime && e.end?.dateTime)
          .map((e) => ({
            start: e.start!.dateTime!,
            end: e.end!.dateTime!,
          })) ?? [];
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
    const calendarId = encodeURIComponent(
      auth.credentials.calendar_id ?? "primary",
    );
    if (!token) {
      return {
        status: "fatal",
        errorCode: "gcal_credentials",
        message: "access_token required",
      };
    }
    try {
      const res = await this.fetchImpl(
        `${this.baseUrl}/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Goog-Request-Id": input.idempotencyKey,
          },
          body: JSON.stringify({
            summary: input.title,
            start: { dateTime: input.slotStart },
            end: { dateTime: input.slotEnd },
            attendees: [{ email: input.attendeeEmail }],
            extendedProperties: {
              private: { kanso_idempotency_key: input.idempotencyKey },
            },
          }),
        },
      );
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as { id?: string };
      const eventId = json.id ?? input.idempotencyKey;
      return { status: "ok", data: { eventId }, providerRequestId: eventId };
    } catch (err) {
      return networkError(err);
    }
  }
}

export class MockCalendarAdapter implements CalendarAdapter {
  readonly booked: Array<{ idempotencyKey: string; email: string }> = [];

  async listSlots(
    input: { from: string; to: string; timezone: string },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ slots: { start: string; end: string }[] }>> {
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
  }

  async bookSlot(
    input: {
      slotStart: string;
      slotEnd: string;
      attendeeEmail: string;
      title: string;
      idempotencyKey: string;
    },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ eventId: string }>> {
    this.booked.push({
      idempotencyKey: input.idempotencyKey,
      email: input.attendeeEmail,
    });
    return { status: "ok", data: { eventId: `evt_${input.idempotencyKey}` } };
  }
}

export function createGoogleCalendarAdapter(auth: AuthContext): CalendarAdapter {
  if (auth.credentials.access_token && auth.credentials.sandbox !== "true") {
    return new GoogleCalendarAdapter();
  }
  return new MockCalendarAdapter();
}
