import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

function exportRoot(): string {
  return join(process.env.KANSO_STORAGE_DIR ?? join(process.cwd(), ".data/storage"), "_exports");
}

/** Full workspace export (RGPD art. 20): JSON, no secrets, no password hashes. */
export async function buildWorkspaceExport(pool: Pool, tenantId: string): Promise<Record<string, unknown>> {
  const q = async (sql: string) => (await pool.query(sql, [tenantId])).rows;
  return {
    exported_at: new Date().toISOString(),
    workspace: (await q(`select tenant_id, display_name, profession, modules, created_at from tenants where tenant_id = $1`))[0],
    members: await q(
      `select u.email, u.name, m.role, m.created_at from memberships m join users u on u.id = m.user_id where m.tenant_id = $1`,
    ),
    subscription: (await q(`select plan, status, billing_interval, trial_ends_at, current_period_end from subscriptions where tenant_id = $1`))[0] ?? null,
    configs: await q(`select product, version, status, config, published_at from tenant_configs where tenant_id = $1 order by product, version`),
    leads: await q(`select id, session_id, contact, answers, score, tier, status, summary, notes, created_at from leads where tenant_id = $1 order by created_at`),
    conversations: await q(
      `select s.id, s.state, s.score_final, s.answers, s.started_at, s.closed_at,
              coalesce(json_agg(json_build_object('role', m.role, 'content', m.content, 'at', m.created_at) order by m.created_at)
                filter (where m.id is not null), '[]') as messages
       from inbound_sessions s left join inbound_messages m on m.session_id = s.id
       where s.tenant_id = $1 group by s.id order by s.started_at`,
    ),
    documents: await q(
      `select id, original_filename, document_type, status, review_status, fields, remote_id, created_at
       from document_jobs where tenant_id = $1 order by created_at`,
    ),
    audit_events: await q(`select at, step, decision, actor, summary from audit_events where tenant_id = $1 order by at`),
  };
}

export function writeExportFile(tenantId: string, requestId: string, data: unknown): string {
  const dir = join(exportRoot(), tenantId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${requestId}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return `file://${path}`;
}

export function readExportFile(ref: string): Buffer {
  if (!ref.startsWith("file://")) throw new Error("unsupported export ref");
  const path = ref.slice("file://".length);
  if (!path.startsWith(exportRoot())) throw new Error("export ref outside export root");
  return readFileSync(path);
}

/** Hard purge after the deletion grace period: DB rows cascade from tenants. */
export async function purgeTenant(pool: Pool, tenantId: string): Promise<void> {
  await pool.query(`delete from tenants where tenant_id = $1`, [tenantId]);
  const storage = process.env.KANSO_STORAGE_DIR ?? join(process.cwd(), ".data/storage");
  rmSync(join(storage, tenantId), { recursive: true, force: true });
  rmSync(join(exportRoot(), tenantId), { recursive: true, force: true });
}
