import { templates } from "@kanso/mailer";
import {
  buildWorkspaceExport,
  getPool,
  purgeTenant,
  runRetentionPurge,
  writeExportFile,
} from "@kanso/tenancy";
import { appLink, notifyAdmins, sendTo } from "./notify.js";

type Job = {
  name: string;
  everyMs: number;
  run: () => Promise<Record<string, unknown>>;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

async function trialReminders(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const res = await pool.query<{ tenant_id: string; display_name: string; days_left: number }>(
    `select s.tenant_id, t.display_name,
            ceil(extract(epoch from (s.trial_ends_at - now())) / 86400)::int as days_left
     from subscriptions s join tenants t on t.tenant_id = s.tenant_id
     where s.status = 'trialing' and s.stripe_subscription_id is null and t.deleted_at is null
       and s.trial_ends_at < now() + interval '3 days 1 hour'
       and s.trial_ends_at > now() - interval '2 days'`,
  );
  let sent = 0;
  for (const r of res.rows) {
    const bucket = r.days_left <= 0 ? 0 : 3;
    if (bucket === 3 && r.days_left > 3) continue;
    const type = `trial:${bucket}`;
    const exists = await pool.query(`select 1 from notifications where tenant_id = $1 and type = $2`, [r.tenant_id, type]);
    if ((exists.rowCount ?? 0) > 0) continue;
    const link = `/app/${r.tenant_id}/facturation`;
    const daysLeft = Math.max(0, r.days_left);
    await notifyAdmins(r.tenant_id, {
      type,
      title: daysLeft <= 0 ? "Votre essai est terminé" : `Plus que ${daysLeft} jours d'essai`,
      link,
      email: (workspace) => templates.trialEnding({ workspace, daysLeft, url: appLink(link) }),
    });
    sent++;
  }
  return { sent };
}

async function processExports(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const claimed = await pool.query<{ id: string; tenant_id: string; requested_by: string | null }>(
    `update data_requests set status = 'running'
     where id in (select id from data_requests where kind = 'export' and status = 'pending'
                  order by created_at limit 3 for update skip locked)
     returning id, tenant_id, requested_by`,
  );
  for (const r of claimed.rows) {
    try {
      const data = await buildWorkspaceExport(pool, r.tenant_id);
      const ref = writeExportFile(r.tenant_id, r.id, data);
      await pool.query(`update data_requests set status = 'done', file_ref = $2, completed_at = now() where id = $1`, [r.id, ref]);
      const user = r.requested_by
        ? await pool.query<{ email: string }>(`select email from users where id = $1`, [r.requested_by])
        : null;
      const ws = await pool.query<{ display_name: string }>(`select display_name from tenants where tenant_id = $1`, [r.tenant_id]);
      const link = `/app/${r.tenant_id}/parametres/donnees`;
      if (user?.rows[0]) {
        await sendTo(user.rows[0].email, templates.exportReady({ workspace: ws.rows[0]?.display_name ?? r.tenant_id, url: appLink(link) }));
      }
      await pool.query(`insert into notifications (tenant_id, type, title, link) values ($1, 'rgpd:export', 'Export de données prêt', $2)`, [
        r.tenant_id,
        link,
      ]);
    } catch (err) {
      await pool.query(`update data_requests set status = 'failed', error = $2 where id = $1`, [
        r.id,
        err instanceof Error ? err.message.slice(0, 300) : "export_failed",
      ]);
    }
  }
  return { processed: claimed.rowCount ?? 0 };
}

async function purgeDeletedTenants(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const res = await pool.query<{ tenant_id: string }>(
    `select tenant_id from tenants where deleted_at is not null and deleted_at <= now() limit 20`,
  );
  for (const r of res.rows) await purgeTenant(pool, r.tenant_id);
  return { purged: res.rows.length };
}

async function cleanup(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const q = async (sql: string) => (await pool.query(sql)).rowCount ?? 0;
  return {
    auth_tokens: await q(`delete from auth_tokens where expires_at < now() - interval '7 days'`),
    auth_sessions: await q(`delete from auth_sessions where expires_at < now() - interval '7 days' or revoked_at < now() - interval '7 days'`),
    rate_limits: await q(`delete from rate_limits where window_start < now() - interval '1 day'`),
    invitations: await q(`delete from invitations where expires_at < now() - interval '30 days'`),
    mail_outbox: await q(`delete from mail_outbox where created_at < now() - interval '14 days'`),
    stripe_events: await q(`delete from stripe_events where received_at < now() - interval '90 days'`),
    notifications: await q(`delete from notifications where created_at < now() - interval '180 days'`),
    contact_requests: await q(`delete from contact_requests where created_at < now() - interval '3 years'`),
  };
}

async function resetDemo(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const s = await pool.query(`delete from inbound_sessions where tenant_id = 'demo-public' and started_at < now() - interval '1 hour'`);
  await pool.query(`delete from notifications where tenant_id = 'demo-public' and created_at < now() - interval '1 hour'`);
  await pool.query(`delete from usage_counters where tenant_id = 'demo-public'`);
  return { sessions: s.rowCount ?? 0 };
}

export const JOBS: Job[] = [
  { name: "exports", everyMs: MIN, run: processExports },
  { name: "demo_reset", everyMs: HOUR, run: resetDemo },
  { name: "purge_deleted_tenants", everyMs: HOUR, run: purgeDeletedTenants },
  { name: "trial_reminders", everyMs: 6 * HOUR, run: trialReminders },
  { name: "cleanup", everyMs: DAY, run: cleanup },
  {
    name: "retention",
    everyMs: DAY,
    run: async () => {
      const r = await runRetentionPurge(getPool(), { dryRun: process.env.KANSO_RETENTION_DRY_RUN === "1" });
      return { dry_run: r.dryRun, deleted: r.deleted };
    },
  },
];

/**
 * Run due jobs once. Each job is guarded by a transaction-level advisory lock
 * so several worker replicas never run the same job concurrently.
 */
export async function runDueJobs(now = Date.now()): Promise<string[]> {
  const pool = getPool();
  const ran: string[] = [];
  for (const job of JOBS) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const lock = await client.query<{ ok: boolean }>(`select pg_try_advisory_xact_lock(hashtext($1)) as ok`, [`kanso:job:${job.name}`]);
      if (!lock.rows[0]?.ok) {
        await client.query("rollback");
        continue;
      }
      const last = await client.query<{ last_run_at: Date }>(`select last_run_at from scheduled_runs where job = $1`, [job.name]);
      const lastAt = last.rows[0] ? new Date(last.rows[0].last_run_at).getTime() : 0;
      if (now - lastAt < job.everyMs) {
        await client.query("rollback");
        continue;
      }
      let result: Record<string, unknown>;
      try {
        result = await job.run();
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      await client.query(
        `insert into scheduled_runs (job, last_run_at, last_result) values ($1, now(), $2::jsonb)
         on conflict (job) do update set last_run_at = now(), last_result = excluded.last_result`,
        [job.name, JSON.stringify(result)],
      );
      await client.query("commit");
      ran.push(job.name);
      if (job.name !== "exports" || (result.processed as number) > 0) {
        console.log(JSON.stringify({ level: "info", event: "scheduled_job", job: job.name, result }));
      }
    } catch (err) {
      await client.query("rollback").catch(() => undefined);
      console.error(JSON.stringify({ level: "error", event: "scheduled_job_failed", job: job.name, message: err instanceof Error ? err.message : String(err) }));
    } finally {
      client.release();
    }
  }
  return ran;
}
