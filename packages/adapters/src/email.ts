import nodemailer from "nodemailer";
import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import type { AlertAdapter } from "./types.js";

export type SmtpCredentials = {
  host: string;
  port?: string;
  user?: string;
  pass?: string;
  from: string;
  to: string;
  secure?: string;
};

/**
 * SMTP e-mail alert adapter (OVH SMTP, Brevo SMTP, etc.).
 * AuthContext.credentials must include host/from/to; user/pass optional for open relays (dev only).
 * EU: prefer OVH or Brevo SMTP endpoints — *hypothèse à vérifier* selon compte.
 */
export class SmtpEmailAlertAdapter implements AlertAdapter {
  constructor(
    private readonly createTransport: typeof nodemailer.createTransport = nodemailer.createTransport,
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
    if (input.channel !== "email") {
      return {
        status: "fatal",
        errorCode: "wrong_channel",
        message: "SmtpEmailAlertAdapter only supports email",
      };
    }

    const c = auth.credentials as Partial<SmtpCredentials>;
    if (!c.host || !c.from || !c.to) {
      return {
        status: "fatal",
        errorCode: "smtp_credentials_incomplete",
        message: "Need host, from, to in secret credentials",
      };
    }

    try {
      const port = Number(c.port ?? "587");
      const transporter = this.createTransport({
        host: c.host,
        port,
        secure: c.secure === "true" || port === 465,
        auth:
          c.user && c.pass
            ? { user: c.user, pass: c.pass }
            : undefined,
      });

      const info = await transporter.sendMail({
        from: c.from,
        to: c.to,
        subject: `[Kanso] ${input.event}: ${input.title}`,
        text: `${input.body}\n\nmetadata: ${JSON.stringify(input.metadata)}`,
      });

      return {
        status: "ok",
        data: { delivered: true },
        providerRequestId:
          typeof info.messageId === "string" ? info.messageId : undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable =
        /timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|421|450|451|452|rate/i.test(
          message,
        );
      return {
        status: retryable ? "retryable" : "fatal",
        errorCode: retryable ? "smtp_transient" : "smtp_fatal",
        message: message.slice(0, 300),
      };
    }
  }
}

/**
 * Local/dev: no SMTP host → log structured alert (never fails delivery for smoke tests).
 */
export class ConsoleEmailAlertAdapter implements AlertAdapter {
  readonly sent: Array<{ event: string; title: string; to?: string }> = [];

  async send(
    input: {
      channel: "email" | "slack";
      event: string;
      title: string;
      body: string;
      metadata: Record<string, string | number | boolean>;
    },
    auth: AuthContext,
    ctx: AdapterContext,
  ): Promise<AdapterResult<{ delivered: true }>> {
    if (input.channel !== "email") {
      return {
        status: "fatal",
        errorCode: "wrong_channel",
        message: "ConsoleEmailAlertAdapter only supports email",
      };
    }
    this.sent.push({
      event: input.event,
      title: input.title,
      to: auth.credentials.to,
    });
    console.log(
      JSON.stringify({
        level: "info",
        msg: "alert.email.console",
        event: input.event,
        title: input.title,
        to: auth.credentials.to,
        tenant_id: ctx.tenantId,
        correlation_id: ctx.correlationId,
      }),
    );
    return { status: "ok", data: { delivered: true } };
  }
}

export function createEmailAlertAdapter(auth: AuthContext): AlertAdapter {
  if (auth.credentials.host) {
    return new SmtpEmailAlertAdapter();
  }
  return new ConsoleEmailAlertAdapter();
}
