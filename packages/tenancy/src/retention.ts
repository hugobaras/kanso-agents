import type { Pool } from "pg";

/** Politique phase 6 — 90 / 90 / 365 / 30 (logs appli hors DB). */
export const RETENTION_DAYS = {
  inboundSessions: 90,
  documentJobs: 90,
  auditEvents: 365,
  usageLedger: 365,
  adapterDeadLetters: 90,
  appLogs: 30,
} as const;

export type PurgeBucketCounts = {
  inbound_sessions: number;
  inbound_messages: number;
  document_jobs: number;
  audit_events: number;
  usage_ledger: number;
  adapter_dead_letters: number;
};

export type RetentionPurgeResult = {
  dryRun: boolean;
  days: typeof RETENTION_DAYS;
  deleted: PurgeBucketCounts;
  note: string;
};

/**
 * Purge quotidienne. dryRun=true → compte seulement (1re semaine prod).
 * Les messages Inbound partent en cascade avec les sessions (hors dry-run).
 */
export async function runRetentionPurge(
  pool: Pool,
  opts: { dryRun?: boolean } = {},
): Promise<RetentionPurgeResult> {
  const dryRun = opts.dryRun ?? true;
  const d = RETENTION_DAYS;

  const messagesPreview = await countMessagesForExpiredSessions(
    pool,
    d.inboundSessions,
  );

  const sessions = await purgeWithDays(
    pool,
    dryRun,
    d.inboundSessions,
    `select count(*)::text as n from inbound_sessions
     where coalesce(closed_at, last_activity_at) < now() - make_interval(days => $1)`,
    `delete from inbound_sessions
     where coalesce(closed_at, last_activity_at) < now() - make_interval(days => $1)`,
  );

  const documentJobs = await purgeWithDays(
    pool,
    dryRun,
    d.documentJobs,
    `select count(*)::text as n from document_jobs
     where created_at < now() - make_interval(days => $1)`,
    `delete from document_jobs
     where created_at < now() - make_interval(days => $1)`,
  );

  const auditEvents = await purgeWithDays(
    pool,
    dryRun,
    d.auditEvents,
    `select count(*)::text as n from audit_events
     where at < now() - make_interval(days => $1)`,
    `delete from audit_events
     where at < now() - make_interval(days => $1)`,
  );

  const usageLedger = await purgeWithDays(
    pool,
    dryRun,
    d.usageLedger,
    `select count(*)::text as n from usage_ledger
     where at < now() - make_interval(days => $1)`,
    `delete from usage_ledger
     where at < now() - make_interval(days => $1)`,
  );

  const deadLetters = await purgeWithDays(
    pool,
    dryRun,
    d.adapterDeadLetters,
    `select count(*)::text as n from adapter_dead_letters
     where coalesce(resolved_at, created_at) < now() - make_interval(days => $1)`,
    `delete from adapter_dead_letters
     where coalesce(resolved_at, created_at) < now() - make_interval(days => $1)`,
  );

  return {
    dryRun,
    days: RETENTION_DAYS,
    deleted: {
      inbound_sessions: sessions,
      inbound_messages: messagesPreview,
      document_jobs: documentJobs,
      audit_events: auditEvents,
      usage_ledger: usageLedger,
      adapter_dead_letters: deadLetters,
    },
    note: `Logs applicatifs (${d.appLogs} j) : rotation stdout / Grafana, hors ce job SQL.`,
  };
}

async function purgeWithDays(
  pool: Pool,
  dryRun: boolean,
  days: number,
  countSql: string,
  deleteSql: string,
): Promise<number> {
  if (dryRun) {
    const res = await pool.query<{ n: string }>(countSql, [days]);
    return Number(res.rows[0]?.n ?? 0);
  }
  const res = await pool.query(deleteSql, [days]);
  return res.rowCount ?? 0;
}

async function countMessagesForExpiredSessions(
  pool: Pool,
  days: number,
): Promise<number> {
  const res = await pool.query<{ n: string }>(
    `select count(*)::text as n from inbound_messages m
     join inbound_sessions s on s.id = m.session_id
     where coalesce(s.closed_at, s.last_activity_at) < now() - make_interval(days => $1)`,
    [days],
  );
  return Number(res.rows[0]?.n ?? 0);
}
