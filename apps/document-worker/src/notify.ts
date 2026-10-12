import { createMailTransport, sendMail, type MailTransport, type RenderedEmail } from "@kanso/mailer";
import { getPool } from "@kanso/tenancy";

let transport: MailTransport | null = null;
function mail(): MailTransport {
  transport ??= createMailTransport(getPool());
  return transport;
}

export function appLink(path: string): string {
  return `${(process.env.KANSO_APP_URL ?? "http://localhost:3001").replace(/\/$/, "")}${path}`;
}

/** In-app notification for the workspace + optional e-mail to owners/admins. */
export async function notifyAdmins(
  tenantId: string,
  opts: {
    type: string;
    title: string;
    body?: string;
    link?: string;
    email?: (workspaceName: string) => RenderedEmail;
  },
): Promise<void> {
  const pool = getPool();
  await pool.query(`insert into notifications (tenant_id, type, title, body, link) values ($1, $2, $3, $4, $5)`, [
    tenantId,
    opts.type,
    opts.title,
    opts.body ?? null,
    opts.link ?? null,
  ]);
  if (!opts.email) return;
  const ws = await pool.query<{ display_name: string }>(`select display_name from tenants where tenant_id = $1`, [tenantId]);
  const recipients = await pool.query<{ email: string }>(
    `select u.email from memberships m join users u on u.id = m.user_id
     where m.tenant_id = $1 and m.role in ('owner', 'admin')`,
    [tenantId],
  );
  const email = opts.email(ws.rows[0]?.display_name ?? tenantId);
  for (const r of recipients.rows) await sendMail(mail(), r.email, email);
}

export async function sendTo(to: string, email: RenderedEmail): Promise<void> {
  await sendMail(mail(), to, email);
}
