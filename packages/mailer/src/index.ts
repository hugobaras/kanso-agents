import nodemailer from "nodemailer";
import type { Pool } from "pg";
import type { RenderedEmail } from "./templates.js";

export { templates, type RenderedEmail } from "./templates.js";
export { escapeHtml, renderEmail } from "./layout.js";

export type MailTransport = {
  readonly name: "smtp" | "console";
  send(to: string, email: RenderedEmail): Promise<void>;
};

/**
 * Dev / pre-prod transport: logs a one-line JSON summary and stores the full
 * message in mail_outbox (readable from the dev outbox page and e2e tests).
 */
export class ConsoleTransport implements MailTransport {
  readonly name = "console" as const;
  constructor(private readonly pool?: Pool) {}

  async send(to: string, email: RenderedEmail): Promise<void> {
    console.log(
      JSON.stringify({
        level: "info",
        event: "mail_console",
        to,
        template: email.template,
        subject: email.subject,
      }),
    );
    if (this.pool) {
      await this.pool.query(
        `insert into mail_outbox (to_email, subject, template, html, text_body, transport)
         values ($1, $2, $3, $4, $5, 'console')`,
        [to, email.subject, email.template, email.html, email.text],
      );
    }
  }
}

/** Platform SMTP (KANSO_SMTP_URL, e.g. smtps://user:pass@ssl0.ovh.net:465). */
export class SmtpTransport implements MailTransport {
  readonly name = "smtp" as const;
  private readonly transporter: ReturnType<typeof nodemailer.createTransport>;
  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transporter = nodemailer.createTransport(url);
  }

  async send(to: string, email: RenderedEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}

export function createMailTransport(pool?: Pool): MailTransport {
  const url = process.env.KANSO_SMTP_URL?.trim();
  if (url) {
    return new SmtpTransport(url, process.env.KANSO_MAIL_FROM ?? "Kanso <no-reply@kanso.fr>");
  }
  return new ConsoleTransport(pool);
}

/** Never throws: mail failures are logged, not surfaced to the end user. */
export async function sendMail(
  transport: MailTransport,
  to: string,
  email: RenderedEmail,
): Promise<boolean> {
  try {
    await transport.send(to, email);
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mail_send_failed",
        template: email.template,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}
