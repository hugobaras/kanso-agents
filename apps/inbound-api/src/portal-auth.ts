import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "@kanso/tenancy";

export type PortalUser = {
  id: string;
  tenant_id: string;
  email: string;
  role: "owner" | "ops";
};

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function findPortalUsersByEmail(
  pool: Pool,
  email: string,
): Promise<PortalUser[]> {
  const res = await pool.query<PortalUser>(
    `select id, tenant_id, email, role from portal_users
     where lower(email) = lower($1)`,
    [email.trim()],
  );
  return res.rows;
}

export async function createMagicLink(
  pool: Pool,
  portalUserId: string,
  ttlMinutes = 20,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = newRawToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  await pool.query(
    `insert into portal_magic_tokens (portal_user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [portalUserId, hashToken(rawToken), expiresAt.toISOString()],
  );
  return { rawToken, expiresAt };
}

export async function consumeMagicLink(
  pool: Pool,
  rawToken: string,
): Promise<PortalUser | null> {
  const tokenHash = hashToken(rawToken);
  const res = await pool.query<{
    id: string;
    portal_user_id: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `select id, portal_user_id, expires_at, consumed_at
     from portal_magic_tokens where token_hash = $1`,
    [tokenHash],
  );
  const row = res.rows[0];
  if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
    return null;
  }
  await pool.query(
    `update portal_magic_tokens set consumed_at = now() where id = $1`,
    [row.id],
  );
  const user = await pool.query<PortalUser>(
    `select id, tenant_id, email, role from portal_users where id = $1`,
    [row.portal_user_id],
  );
  return user.rows[0] ?? null;
}

export async function createPortalSession(
  pool: Pool,
  portalUserId: string,
  ttlDays = 7,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = newRawToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60_000);
  await pool.query(
    `insert into portal_sessions (portal_user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [portalUserId, hashToken(rawToken), expiresAt.toISOString()],
  );
  return { rawToken, expiresAt };
}

export async function resolvePortalSession(
  pool: Pool,
  rawToken: string | undefined,
): Promise<PortalUser | null> {
  if (!rawToken) return null;
  const res = await pool.query<PortalUser & { expires_at: Date }>(
    `select u.id, u.tenant_id, u.email, u.role, s.expires_at
     from portal_sessions s
     join portal_users u on u.id = s.portal_user_id
     where s.token_hash = $1 and s.revoked_at is null`,
    [hashToken(rawToken)],
  );
  const row = res.rows[0];
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    email: row.email,
    role: row.role,
  };
}

export async function revokePortalSession(
  pool: Pool,
  rawToken: string,
): Promise<void> {
  await pool.query(
    `update portal_sessions set revoked_at = now()
     where token_hash = $1 and revoked_at is null`,
    [hashToken(rawToken)],
  );
}

export async function auditPortal(
  pool: Pool,
  opts: {
    tenantId: string;
    actor: string;
    step: string;
    decision: string;
    summary?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `insert into audit_events
      (tenant_id, at, step, decision, summary, actor, correlation_id)
     values ($1, now(), $2, $3, $4::jsonb, $5, $6)`,
    [
      opts.tenantId,
      opts.step,
      opts.decision,
      JSON.stringify(opts.summary ?? {}),
      opts.actor,
      `portal:${opts.actor}`,
    ],
  );
}
