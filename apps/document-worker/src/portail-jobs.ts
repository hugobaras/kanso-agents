import { templates } from "@kanso/mailer";
import { issueLink, loadBrand, purgeDossier } from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { appLink, sendTo } from "./notify.js";


type Contact = { id: string; email: string; name: string };

async function contactsOf(dossierId: string): Promise<Contact[]> {
  const r = await getPool().query<Contact>(`select id, email::text as email, name from portal_contacts where dossier_id = $1`, [dossierId]);
  return r.rows;
}

async function cabinetEmails(tenantId: string, assignee: string | null): Promise<string[]> {
  const pool = getPool();
  if (assignee) {
    const a = await pool.query<{ email: string }>(`select email from users where id = $1`, [assignee]);
    if (a.rows[0]) return [a.rows[0].email];
  }
  const r = await pool.query<{ email: string }>(
    `select u.email from memberships m join users u on u.id = m.user_id where m.tenant_id = $1 and m.role in ('owner','admin')`,
    [tenantId],
  );
  return r.rows.map((x) => x.email);
}

const fr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

/** Relances des clients qui n'ont pas tout déposé (réglables par cabinet). */
export async function portailReminders(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const due = await pool.query<{ id: string; tenant_id: string; title: string }>(
    `select d.id, d.tenant_id, d.title
     from portal_dossiers d
     join portal_settings s on s.tenant_id = d.tenant_id
     join tenants t on t.tenant_id = d.tenant_id
     where d.stage = 'a_completer' and t.deleted_at is null and (t.modules->>'portail')::boolean is true
       and t.status <> 'suspended'
       -- No reminders to end clients once the cabinet's subscription has lapsed.
       and exists (select 1 from subscriptions sub where sub.tenant_id = t.tenant_id
                   and (sub.status in ('active', 'past_due') or (sub.status = 'trialing' and sub.trial_ends_at > now())))
       and (s.reminders->>'enabled')::boolean is true
       and d.reminder_count < (s.reminders->>'max')::int
       and coalesce(d.last_reminder_at + make_interval(days => (s.reminders->>'every_days')::int),
                    d.created_at + make_interval(days => (s.reminders->>'first_after_days')::int)) <= now()
     limit 200`,
  );
  let sent = 0;
  for (const d of due.rows) {
    const missing = await pool.query<{ label: string }>(
      `select label from portal_items where dossier_id = $1 and required and status in ('pending','refused') order by position`,
      [d.id],
    );
    // marque d'abord : un échec d'envoi ne doit pas provoquer une rafale à chaque passage
    await pool.query(`update portal_dossiers set last_reminder_at = now(), reminder_count = reminder_count + 1 where id = $1`, [d.id]);
    if (missing.rows.length === 0) continue;
    const brand = await loadBrand(pool, d.tenant_id);
    for (const c of await contactsOf(d.id)) {
      const link = await issueLink(pool, c.id);
      await sendTo(c.email, templates.portalReminder({ brand, clientName: c.name, title: d.title, url: link.url, missing: missing.rows.map((m) => m.label) }));
      sent++;
    }
  }
  return { dossiers: due.rows.length, sent };
}

/** Résumé quotidien pour chaque cabinet : dépôts, messages, dossiers complets depuis le dernier résumé. */
export async function portailDigest(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Paris" }));
  if (hour < 8 && process.env.KANSO_DIGEST_ANYTIME !== "1") return { skipped: "before_8h" };
  const tenants = await pool.query<{ tenant_id: string; display_name: string; last_digest_at: Date }>(
    `select s.tenant_id, t.display_name, s.last_digest_at from portal_settings s join tenants t on t.tenant_id = s.tenant_id
     where t.deleted_at is null and (t.modules->>'portail')::boolean is true and s.last_digest_at < now() - interval '23 hours'`,
  );
  let sent = 0;
  for (const t of tenants.rows) {
    const [files, msgs, complete] = await Promise.all([
      pool.query<{ n: number }>(`select count(*)::int as n from portal_files where tenant_id = $1 and created_at > $2 and deleted_at is null`, [t.tenant_id, t.last_digest_at]),
      pool.query<{ n: number }>(`select count(*)::int as n from portal_messages where tenant_id = $1 and author_kind = 'client' and created_at > $2`, [t.tenant_id, t.last_digest_at]),
      pool.query<{ n: number }>(`select count(*)::int as n from portal_dossiers where tenant_id = $1 and stage in ('en_verification','complet') and updated_at > $2`, [t.tenant_id, t.last_digest_at]),
    ]);
    await pool.query(`update portal_settings set last_digest_at = now() where tenant_id = $1`, [t.tenant_id]);
    const f = files.rows[0]!.n;
    const m = msgs.rows[0]!.n;
    const c = complete.rows[0]!.n;
    if (f + m + c === 0) continue;
    const a = await pool.query<{ email: string }>(
      `select u.email from memberships mm join users u on u.id = mm.user_id where mm.tenant_id = $1 and mm.role in ('owner','admin')`,
      [t.tenant_id],
    );
    const email = templates.portalCabinetDigest({
      workspace: t.display_name,
      url: appLink(`/app/${t.tenant_id}/portail`),
      rows: [
        ["Documents déposés", String(f)],
        ["Messages de clients", String(m)],
        ["Dossiers à vérifier", String(c)],
      ],
    });
    for (const r of a.rows) {
      await sendTo(r.email, email);
      sent++;
    }
  }
  return { tenants: tenants.rows.length, sent };
}

/** Avertit 7 jours avant la suppression, puis supprime (objets + lignes) à l'échéance. */
export async function portailRetention(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const warn = await pool.query<{ id: string; tenant_id: string; title: string; reference: string; purge_at: Date; assignee_user_id: string | null; display_name: string }>(
    `select d.id, d.tenant_id, d.title, d.reference, d.purge_at, d.assignee_user_id, t.display_name
     from portal_dossiers d join tenants t on t.tenant_id = d.tenant_id
     where d.purge_at is not null and d.purge_notified_at is null and d.purge_at <= now() + interval '7 days' and d.purge_at > now()`,
  );
  for (const d of warn.rows) {
    const brand = await loadBrand(pool, d.tenant_id);
    const date = fr(new Date(d.purge_at));
    for (const c of await contactsOf(d.id)) await sendTo(c.email, templates.portalPurgeNotice({ brand, title: d.title, date }));
    for (const e of await cabinetEmails(d.tenant_id, d.assignee_user_id)) {
      await sendTo(e, templates.portalCabinetPurgeNotice({ workspace: d.display_name, reference: d.reference, title: d.title, date, url: appLink(`/app/${d.tenant_id}/portail/${d.id}`) }));
    }
    await pool.query(`update portal_dossiers set purge_notified_at = now() where id = $1`, [d.id]);
  }
  const expired = await pool.query<{ id: string }>(`select id from portal_dossiers where purge_at is not null and purge_at <= now() limit 100`);
  let purged = 0;
  let failed = 0;
  for (const d of expired.rows) {
    try {
      await purgeDossier(pool, d.id);
      purged++;
    } catch {
      failed++;
    }
  }
  return { warned: warn.rows.length, purged, failed };
}

export async function portailCleanup(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const q = async (sql: string) => (await pool.query(sql)).rowCount ?? 0;
  return {
    links: await q(`delete from portal_links where expires_at < now() - interval '30 days'`),
    codes: await q(`delete from portal_login_codes where expires_at < now() - interval '1 day'`),
    sessions: await q(`delete from portal_client_sessions where expires_at < now() - interval '1 day' or revoked_at < now() - interval '1 day'`),
  };
}

