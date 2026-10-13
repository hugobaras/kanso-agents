import { LINK_DAYS, issueLink, loadBrand, loadItems } from "@kanso/portal";
import { templates } from "@kanso/mailer";
import { getPool } from "@kanso/tenancy";
import { deliver } from "./mail.js";
import { appLink } from "./mail.js";

export type DossierRow = {
  id: string;
  tenant_id: string;
  reference: string;
  title: string;
  client_name: string;
  client_kind: "particulier" | "entreprise";
  stage: "a_completer" | "en_verification" | "complet" | "termine";
  cabinet_message: string | null;
  assignee_user_id: string | null;
  lead_id: string | null;
  source: string;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  purge_at: Date | null;
};

export type ContactRow = { id: string; dossier_id: string; email: string; name: string };

/** Envoie l'invitation initiale (ou un renvoi : les anciens liens sont alors révoqués). */
export async function sendLinkEmail(
  d: Pick<DossierRow, "id" | "tenant_id" | "title" | "cabinet_message">,
  contact: ContactRow,
  kind: "invite" | "resend",
): Promise<boolean> {
  const pool = getPool();
  const brand = await loadBrand(pool, d.tenant_id);
  const link = await issueLink(pool, contact.id, { revokeOthers: kind === "resend" });
  if (kind === "resend") {
    return deliver(contact.email, templates.portalResend({ brand, clientName: contact.name, title: d.title, url: link.url, days: LINK_DAYS }));
  }
  const items = (await loadItems(pool, d.id)).filter((i) => i.required).map((i) => i.label);
  return deliver(
    contact.email,
    templates.portalInvite({ brand, clientName: contact.name, title: d.title, url: link.url, items, message: d.cabinet_message, days: LINK_DAYS }),
  );
}

export function dossierUrl(workspace: string, id: string): string {
  return appLink(`/app/${workspace}/portail/${id}`);
}

/** Destinataires d'une notification cabinet : le responsable, sinon les administrateurs. */
export async function cabinetRecipients(tenantId: string, assigneeUserId: string | null): Promise<string[]> {
  const pool = getPool();
  if (assigneeUserId) {
    const r = await pool.query<{ email: string }>(`select email from users where id = $1`, [assigneeUserId]);
    if (r.rows[0]) return [r.rows[0].email];
  }
  const r = await pool.query<{ email: string }>(
    `select u.email from memberships m join users u on u.id = m.user_id where m.tenant_id = $1 and m.role in ('owner','admin')`,
    [tenantId],
  );
  return r.rows.map((x) => x.email);
}
