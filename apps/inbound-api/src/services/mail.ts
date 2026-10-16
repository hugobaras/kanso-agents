import { createMailTransport, sendMail, type MailTransport, type RenderedEmail } from "@kanso/mailer";
import { getPool } from "@kanso/tenancy";
import { PLANS, isPlanId, type PlanProduct } from "@kanso/billing";
import { appUrl, portailUrl } from "../env.js";

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

/** Link on the domain of the product a workspace is subscribed to. */
export function productLink(product: PlanProduct, path: string): string {
  const base = product === "portail" ? portailUrl() : appUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function tenantProduct(tenantId: string): Promise<PlanProduct> {
  const res = await getPool().query<{ plan: string }>(`select plan from subscriptions where tenant_id = $1`, [tenantId]);
  const plan = res.rows[0]?.plan;
  return isPlanId(plan) ? PLANS[plan].product : "assistant";
}

export async function tenantLink(tenantId: string, path: string): Promise<string> {
  return productLink(await tenantProduct(tenantId), path);
}

/** Product of the user's oldest workspace (recovery e-mails go to the domain they signed up on). */
export async function userLink(userId: string, path: string): Promise<string> {
  const res = await getPool().query<{ tenant_id: string }>(
    `select tenant_id from memberships where user_id = $1 order by created_at limit 1`,
    [userId],
  );
  const t = res.rows[0]?.tenant_id;
  return t ? tenantLink(t, path) : appLink(path);
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
