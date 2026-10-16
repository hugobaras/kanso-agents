import type { WidgetConfig } from "./config.js";

export type ExpectedQuestion = {
  id: string;
  prompt: string;
  type: string;
  options: Array<{ id: string; label: string }> | null;
};

export type PublicConfig = {
  available: boolean;
  unavailable_message: string | null;
  display_name?: string;
  locale?: "fr" | "en";
  primary_color?: string;
  logo_url?: string | null;
  welcome_message?: string | null;
  ai_notice?: string;
  blocked_now?: boolean;
  after_hours_message?: string | null;
  privacy_url?: string;
};

export type SessionStart = {
  session_id: string;
  state: string;
  assistant_message: string;
  after_hours?: boolean;
  expected_question?: ExpectedQuestion | null;
};

export type Turn = {
  session_id: string;
  state: string;
  assistant_message: string;
  expected_question?: ExpectedQuestion | null;
  closed?: boolean;
};

export type Transcript = {
  session_id: string;
  state: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  expected_question: ExpectedQuestion | null;
};

/** Error carrying the server's user-facing message (quota, after hours, …). */
export class WidgetApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly assistantMessage: string | null,
  ) {
    super(code);
  }
}

export class WidgetApi {
  constructor(private readonly cfg: WidgetConfig) {}

  private url(path: string): string {
    if (this.cfg.key) return `${this.cfg.apiBase}/v1/widget${path}`;
    // Legacy: /v1/:tenantId/sessions…
    return `${this.cfg.apiBase}/v1/${encodeURIComponent(this.cfg.tenantId!)}${path}`;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.url(path), {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(this.cfg.key ? { "X-Kanso-Key": this.cfg.key } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "omit",
      });
    } catch {
      throw new WidgetApiError(0, "network", null);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; assistant_message?: string };
    if (!res.ok) {
      throw new WidgetApiError(res.status, data.error ?? `http_${res.status}`, data.assistant_message ?? null);
    }
    return data as T;
  }

  async config(): Promise<PublicConfig> {
    if (!this.cfg.key) return { available: true, unavailable_message: null };
    return this.call<PublicConfig>("GET", `/config?key=${encodeURIComponent(this.cfg.key)}`);
  }

  ping(): void {
    if (!this.cfg.key) return;
    void this.call("POST", "/ping", {}).catch(() => undefined);
  }

  start(): Promise<SessionStart> {
    return this.call<SessionStart>("POST", "/sessions", {});
  }

  resume(sessionId: string): Promise<Transcript> {
    if (!this.cfg.key) return Promise.reject(new WidgetApiError(404, "not_supported", null));
    return this.call<Transcript>("GET", `/sessions/${encodeURIComponent(sessionId)}/messages`);
  }

  send(sessionId: string, text: string): Promise<Turn> {
    return this.call<Turn>("POST", `/sessions/${encodeURIComponent(sessionId)}/messages`, { text });
  }
}
