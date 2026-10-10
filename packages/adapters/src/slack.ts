import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import type { AlertAdapter } from "./types.js";

export type SlackCredentials = {
  webhook_url?: string;
};

/**
 * Slack Incoming Webhook. Secret: `{ "webhook_url": "https://hooks.slack.com/..." }`.
 * Sans URL → console (smoke local). Transfert hors UE : à valider DPA avant prod.
 */
export class SlackWebhookAlertAdapter implements AlertAdapter {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async send(
    input: {
      channel: "email" | "slack";
      event: string;
      title: string;
      body: string;
      metadata: Record<string, string | number | boolean>;
    },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ delivered: true }>> {
    if (input.channel !== "slack") {
      return {
        status: "fatal",
        errorCode: "wrong_channel",
        message: "SlackWebhookAlertAdapter only supports slack",
      };
    }

    const url = auth.credentials.webhook_url;
    if (!url) {
      return {
        status: "fatal",
        errorCode: "slack_credentials_incomplete",
        message: "Need webhook_url in secret credentials",
      };
    }

    try {
      const text = `*[Kanso] ${input.event}* — ${input.title}\n${input.body}\n\`${JSON.stringify(input.metadata)}\``;
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        return {
          status: retryable ? "retryable" : "fatal",
          errorCode: retryable ? "slack_transient" : "slack_fatal",
          message: `Slack HTTP ${res.status}`,
        };
      }
      return { status: "ok", data: { delivered: true } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = /timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(
        message,
      );
      return {
        status: retryable ? "retryable" : "fatal",
        errorCode: retryable ? "slack_transient" : "slack_fatal",
        message: message.slice(0, 300),
      };
    }
  }
}

export class ConsoleSlackAlertAdapter implements AlertAdapter {
  readonly sent: Array<{ event: string; title: string }> = [];

  async send(
    input: {
      channel: "email" | "slack";
      event: string;
      title: string;
      body: string;
      metadata: Record<string, string | number | boolean>;
    },
    _auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ delivered: true }>> {
    if (input.channel !== "slack") {
      return {
        status: "fatal",
        errorCode: "wrong_channel",
        message: "ConsoleSlackAlertAdapter only supports slack",
      };
    }
    this.sent.push({ event: input.event, title: input.title });
    console.log(
      JSON.stringify({
        level: "info",
        msg: "alert.slack.console",
        event: input.event,
        title: input.title,
        tenant_id: ctx.tenantId,
        correlation_id: ctx.correlationId,
      }),
    );
    return { status: "ok", data: { delivered: true } };
  }
}

export function createSlackAlertAdapter(auth: AuthContext): AlertAdapter {
  if (auth.credentials.webhook_url) {
    return new SlackWebhookAlertAdapter();
  }
  return new ConsoleSlackAlertAdapter();
}
