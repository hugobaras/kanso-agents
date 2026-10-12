import { createMailTransport, sendMail, type MailTransport, type RenderedEmail } from "@kanso/mailer";
import { getPool } from "@kanso/tenancy";
import { appUrl } from "../env.js";

let transport: MailTransport | null = null;

export function mailTransport(): MailTransport {
  transport ??= createMailTransport(getPool());
  return transport;
}

/** Test hook. */
export function setMailTransport(t: MailTransport | null) {
  transport = t;
}

export function deliver(to: string, email: RenderedEmail): Promise<boolean> {
  return sendMail(mailTransport(), to, email);
}

export function appLink(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** E-mails of owners/admins of a workspace (for billing/system notices). */
export async function workspaceAdminEmails(tenantId: string): Promise<string[]> {
  const res = await getPool().query<{ email: string }>(
    `select u.email from memberships m join users u on u.id = m.user_id
     where m.tenant_id = $1 and m.role in ('owner', 'admin')`,
    [tenantId],
  );
  return res.rows.map((r) => r.email);
}
