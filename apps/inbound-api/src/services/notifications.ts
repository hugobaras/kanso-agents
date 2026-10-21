import { currentPeriod, type Metric } from "@kanso/billing";
import { templates } from "@kanso/mailer";
import { getPool } from "@kanso/tenancy";
import { appLink, deliver, workspaceAdminEmails } from "./mail.js";

export async function createNotification(opts: {
  tenantId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  userId?: string;
}): Promise<void> {
  await getPool().query(
    `insert into notifications (tenant_id, user_id, type, title, body, link) values ($1, $2, $3, $4, $5, $6)`,
    [opts.tenantId, opts.userId ?? null, opts.type, opts.title, opts.body ?? null, opts.link ?? null],
  );
}

const METRIC_LABEL: Record<Metric, string> = { conversations: "conversations", documents: "documents", ai_pages: "pages analysées par l'IA" };

/** Notify owners once per period when usage crosses 80 % and 100 %. */
export async function notifyQuota(tenantId: string, metric: Metric, used: number, limit: number): Promise<void> {
  if (limit <= 0) return;
  const pct = Math.floor((used / limit) * 100);
  const threshold = pct >= 100 ? 100 : pct >= 80 ? 80 : null;
  if (!threshold) return;
  const type = `quota:${metric}:${threshold}:${currentPeriod()}`;
  const pool = getPool();
  const exists = await pool.query(`select 1 from notifications where tenant_id = $1 and type = $2 limit 1`, [
    tenantId,
    type,
  ]);
  if ((exists.rowCount ?? 0) > 0) return;
  const link = `/app/${tenantId}/facturation`;
  await createNotification({
    tenantId,
    type,
    title: threshold === 100 ? `Quota de ${METRIC_LABEL[metric]} atteint` : `80 % du quota de ${METRIC_LABEL[metric]} utilisé`,
    body: `${used} / ${limit} ce mois-ci.`,
    link,
  });
  const ws = await pool.query<{ display_name: string }>(`select display_name from tenants where tenant_id = $1`, [tenantId]);
  const email = templates.quotaWarning({
    workspace: ws.rows[0]?.display_name ?? tenantId,
    metric: METRIC_LABEL[metric],
    pct: threshold,
    url: appLink(link),
  });
  for (const to of await workspaceAdminEmails(tenantId)) await deliver(to, email);
}
