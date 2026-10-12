import type { Pool, PoolClient } from "@kanso/tenancy";
import type { Role, SessionUser } from "../http/types.js";
import { hashToken, newRawToken } from "./crypto.js";

export const SESSION_COOKIE = "kanso_session";
export const SESSION_TTL_DAYS = 30;

type Db = Pool | PoolClient;

export type UserRow = {
  id: string;
  email: string;
  name: string;
  locale: "fr" | "en";
  password_hash: string | null;
  email_verified_at: Date | null;
  is_staff: boolean;
};

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | null> {
  const res = await db.query<UserRow>(
    `select id, email, name, locale, password_hash, email_verified_at, is_staff
     from users where email = $1`,
    [email.trim().toLowerCase()],
  );
  return res.rows[0] ?? null;
}

export async function findUserById(db: Db, id: string): Promise<UserRow | null> {
  const res = await db.query<UserRow>(
    `select id, email, name, locale, password_hash, email_verified_at, is_staff
     from users where id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function createSession(
  db: Db,
  opts: { userId: string; ip?: string; userAgent?: string; impersonatorUserId?: string },
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = newRawToken();
  const ttlDays = opts.impersonatorUserId ? 1 : SESSION_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.query(
    `insert into auth_sessions (user_id, token_hash, expires_at, ip, user_agent, impersonator_user_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      opts.userId,
      hashToken(rawToken),
      expiresAt.toISOString(),
      opts.ip ?? null,
      opts.userAgent?.slice(0, 300) ?? null,
      opts.impersonatorUserId ?? null,
    ],
  );
  if (!opts.impersonatorUserId) {
    await db.query(`update users set last_login_at = now() where id = $1`, [opts.userId]);
  }
  return { rawToken, expiresAt };
}

export async function resolveSession(db: Db, rawToken: string | undefined): Promise<SessionUser | null> {
  if (!rawToken) return null;
  const res = await db.query<{
    session_id: string;
    expires_at: Date;
    last_seen_at: Date;
    impersonator_user_id: string | null;
    id: string;
    email: string;
    name: string;
    locale: "fr" | "en";
    email_verified_at: Date | null;
    is_staff: boolean;
  }>(
    `select s.id as session_id, s.expires_at, s.last_seen_at, s.impersonator_user_id,
            u.id, u.email, u.name, u.locale, u.email_verified_at, u.is_staff
     from auth_sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.revoked_at is null`,
    [hashToken(rawToken)],
  );
  const row = res.rows[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  // Rolling session: refresh last_seen at most every 10 minutes.
  if (Date.now() - new Date(row.last_seen_at).getTime() > 10 * 60_000) {
    await db.query(
      `update auth_sessions set last_seen_at = now(),
         expires_at = case when impersonator_user_id is null
           then greatest(expires_at, now() + interval '${SESSION_TTL_DAYS} days') else expires_at end
       where id = $1`,
      [row.session_id],
    );
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    locale: row.locale,
    email_verified_at: row.email_verified_at,
    // Impersonated sessions never carry staff powers.
    is_staff: row.impersonator_user_id ? false : row.is_staff,
    session_id: row.session_id,
    impersonator_user_id: row.impersonator_user_id,
  };
}

export async function revokeSession(db: Db, rawToken: string): Promise<void> {
  await db.query(`update auth_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null`, [
    hashToken(rawToken),
  ]);
}

export async function revokeAllSessions(db: Db, userId: string, exceptSessionId?: string): Promise<void> {
  await db.query(
    `update auth_sessions set revoked_at = now()
     where user_id = $1 and revoked_at is null and ($2::uuid is null or id <> $2::uuid)`,
    [userId, exceptSessionId ?? null],
  );
}

export type TokenPurpose = "magic" | "verify" | "reset";
const TOKEN_TTL_MIN: Record<TokenPurpose, number> = { magic: 20, verify: 24 * 60, reset: 60 };

export async function issueToken(db: Db, userId: string, purpose: TokenPurpose): Promise<string> {
  const raw = newRawToken();
  await db.query(
    `insert into auth_tokens (user_id, purpose, token_hash, expires_at)
     values ($1, $2, $3, now() + ($4::text || ' minutes')::interval)`,
    [userId, purpose, hashToken(raw), String(TOKEN_TTL_MIN[purpose])],
  );
  return raw;
}

/** Atomically consume a single-use token; returns the user id or null. */
export async function consumeToken(db: Db, raw: string, purpose: TokenPurpose): Promise<string | null> {
  const res = await db.query<{ user_id: string }>(
    `update auth_tokens set consumed_at = now()
     where token_hash = $1 and purpose = $2 and consumed_at is null and expires_at > now()
     returning user_id`,
    [hashToken(raw), purpose],
  );
  return res.rows[0]?.user_id ?? null;
}

export type MembershipRow = {
  tenant_id: string;
  display_name: string;
  role: Role;
  profession: string | null;
  onboarding_completed_at: Date | null;
};

export async function listMemberships(db: Db, userId: string): Promise<MembershipRow[]> {
  const res = await db.query<MembershipRow>(
    `select m.tenant_id, t.display_name, m.role, t.profession, t.onboarding_completed_at
     from memberships m join tenants t on t.tenant_id = m.tenant_id
     where m.user_id = $1 and (t.deleted_at is null or t.deleted_at > now())
     order by m.created_at asc`,
    [userId],
  );
  return res.rows;
}

export async function audit(
  db: Db,
  opts: {
    tenantId: string;
    actor: string;
    step: string;
    decision: string;
    summary?: Record<string, unknown>;
    sessionId?: string;
    jobId?: string;
  },
): Promise<void> {
  await db.query(
    `insert into audit_events (tenant_id, at, step, decision, summary, actor, correlation_id, session_id, job_id)
     values ($1, now(), $2, $3, $4::jsonb, $5, $6, $7::uuid, $8::uuid)`,
    [
      opts.tenantId,
      opts.step,
      opts.decision,
      JSON.stringify(opts.summary ?? {}),
      opts.actor,
      `app:${opts.actor}`,
      opts.sessionId ?? null,
      opts.jobId ?? null,
    ],
  );
}
