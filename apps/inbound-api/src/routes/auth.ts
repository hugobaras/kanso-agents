import { PROFESSIONS, type Profession } from "@kanso/config";
import { templates } from "@kanso/mailer";
import { getPool, withTransaction } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import {
  clearSessionCookie,
  csrfGuard,
  currentUser,
  requireUser,
  sessionToken,
  setSessionCookie,
} from "../auth/middleware.js";
import { dummyPasswordHash, hashPassword, hashToken, passwordProblem, verifyPassword } from "../auth/crypto.js";
import {
  audit,
  consumeToken,
  createSession,
  findUserByEmail,
  findUserById,
  issueToken,
  listMemberships,
  revokeAllSessions,
  revokeSession,
} from "../auth/service.js";
import { badRequest, HttpError } from "../http/errors.js";
import { clientIp, rateLimit, type RateLimiter } from "../http/rate-limit.js";
import type { AppEnv } from "../http/types.js";
import { appLink, deliver } from "../services/mail.js";
import { createWorkspace } from "../services/workspaces.js";

const email = z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(200);
const professionIds = PROFESSIONS.map((p) => p.id) as [Profession, ...Profession[]];

const SignupBody = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email,
  password: z.string(),
  workspace_name: z.string().trim().min(2, "Indiquez le nom de votre cabinet.").max(80),
  profession: z.enum(professionIds),
  accept_terms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions." }) }),
});

async function parse<T extends z.ZodTypeAny>(schema: T, req: { json: () => Promise<unknown> }): Promise<z.infer<T>> {
  return schema.parse(await req.json().catch(() => ({})));
}

const GENERIC_SENT = { ok: true, message: "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé." };

export function authRoutes(limiter: RateLimiter) {
  const app = new Hono<AppEnv>();
  app.use("*", csrfGuard);
  app.use(
    "*",
    rateLimit(limiter, {
      name: "auth_ip",
      limit: Number(process.env.KANSO_AUTH_RATE_LIMIT ?? 30),
      windowSec: 60,
    }),
  );

  async function sendVerification(userId: string, to: string, name: string) {
    const token = await issueToken(getPool(), userId, "verify");
    await deliver(to, templates.verifyEmail({ name, url: appLink(`/verifier-email?token=${encodeURIComponent(token)}`) }));
  }

  app.post("/signup", async (c) => {
    const body = await parse(SignupBody, c.req);
    const problem = passwordProblem(body.password);
    if (problem) throw badRequest("weak_password", problem);
    const pool = getPool();
    if (await findUserByEmail(pool, body.email)) {
      throw new HttpError(409, "email_taken", "Un compte existe déjà avec cette adresse. Connectez-vous.");
    }
    const passwordHash = await hashPassword(body.password);
    const { userId, tenantId } = await withTransaction(pool, async (db) => {
      const u = await db.query<{ id: string }>(
        `insert into users (email, password_hash, name) values ($1, $2, $3) returning id`,
        [body.email, passwordHash, body.name],
      );
      const userId = u.rows[0]!.id;
      const ws = await createWorkspace(db, {
        name: body.workspace_name,
        profession: body.profession,
        ownerUserId: userId,
        ownerEmail: body.email,
      });
      return { userId, tenantId: ws.tenantId };
    });
    const session = await createSession(pool, {
      userId,
      ip: clientIp(c),
      userAgent: c.req.header("user-agent"),
    });
    setSessionCookie(c, session.rawToken, session.expiresAt);
    await sendVerification(userId, body.email, body.name);
    return c.json({ ok: true, workspace: tenantId }, 201);
  });

  app.post(
    "/login",
    rateLimit(limiter, {
      name: "auth_login",
      limit: 8,
      windowSec: 300,
      key: (c) => `${clientIp(c)}`,
    }),
    async (c) => {
      const body = await parse(z.object({ email, password: z.string().min(1).max(200) }), c.req);
      const lim = await limiter.hit(`auth_login_email:${body.email}`, 10, 900);
      if (!lim.ok) throw new HttpError(429, "rate_limited", "Trop de tentatives. Réessayez dans quelques minutes.");
      const pool = getPool();
      const user = await findUserByEmail(pool, body.email);
      const valid = await verifyPassword(body.password, user?.password_hash ?? (await dummyPasswordHash()));
      if (!user || !user.password_hash || !valid) {
        throw new HttpError(401, "invalid_credentials", "E-mail ou mot de passe incorrect.");
      }
      const session = await createSession(pool, { userId: user.id, ip: clientIp(c), userAgent: c.req.header("user-agent") });
      setSessionCookie(c, session.rawToken, session.expiresAt);
      const memberships = await listMemberships(pool, user.id);
      return c.json({ ok: true, workspaces: memberships.map((m) => m.tenant_id) });
    },
  );

  app.post("/logout", async (c) => {
    const token = sessionToken(c);
    if (token) await revokeSession(getPool(), token);
    clearSessionCookie(c);
    return c.json({ ok: true });
  });

  app.post("/magic-link", async (c) => {
    const body = await parse(z.object({ email }), c.req);
    const lim = await limiter.hit(`auth_magic_email:${body.email}`, 3, 900);
    if (!lim.ok) return c.json(GENERIC_SENT);
    const pool = getPool();
    const user = await findUserByEmail(pool, body.email);
    if (user) {
      const token = await issueToken(pool, user.id, "magic");
      await deliver(user.email, templates.magicLink({ url: appLink(`/connexion/lien?token=${encodeURIComponent(token)}`) }));
    }
    return c.json(GENERIC_SENT);
  });

  app.post("/magic-link/consume", async (c) => {
    const body = await parse(z.object({ token: z.string().min(10).max(200) }), c.req);
    const pool = getPool();
    const userId = await consumeToken(pool, body.token, "magic");
    if (!userId) throw new HttpError(401, "invalid_or_expired_token", "Ce lien a expiré ou a déjà été utilisé.");
    // Clicking a magic link proves inbox ownership.
    await pool.query(`update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1`, [userId]);
    const session = await createSession(pool, { userId, ip: clientIp(c), userAgent: c.req.header("user-agent") });
    setSessionCookie(c, session.rawToken, session.expiresAt);
    return c.json({ ok: true });
  });

  app.post("/verify-email", async (c) => {
    const body = await parse(z.object({ token: z.string().min(10).max(200) }), c.req);
    const pool = getPool();
    const userId = await consumeToken(pool, body.token, "verify");
    if (!userId) throw new HttpError(400, "invalid_or_expired_token", "Ce lien de confirmation a expiré.");
    await pool.query(`update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1`, [userId]);
    return c.json({ ok: true });
  });

  app.post("/resend-verification", requireUser, async (c) => {
    const user = currentUser(c);
    if (user.email_verified_at) return c.json({ ok: true, already_verified: true });
    const lim = await limiter.hit(`auth_verify_resend:${user.id}`, 3, 3600);
    if (!lim.ok) throw new HttpError(429, "rate_limited", "Patientez avant de redemander un e-mail.");
    await sendVerification(user.id, user.email, user.name);
    return c.json({ ok: true });
  });

  app.post("/password/forgot", async (c) => {
    const body = await parse(z.object({ email }), c.req);
    const lim = await limiter.hit(`auth_reset_email:${body.email}`, 3, 900);
    if (!lim.ok) return c.json(GENERIC_SENT);
    const pool = getPool();
    const user = await findUserByEmail(pool, body.email);
    if (user) {
      const token = await issueToken(pool, user.id, "reset");
      await deliver(
        user.email,
        templates.passwordReset({ url: appLink(`/mot-de-passe/nouveau?token=${encodeURIComponent(token)}`) }),
      );
    }
    return c.json(GENERIC_SENT);
  });

  app.post("/password/reset", async (c) => {
    const body = await parse(z.object({ token: z.string().min(10).max(200), password: z.string() }), c.req);
    const problem = passwordProblem(body.password);
    if (problem) throw badRequest("weak_password", problem);
    const pool = getPool();
    const userId = await consumeToken(pool, body.token, "reset");
    if (!userId) throw new HttpError(400, "invalid_or_expired_token", "Ce lien a expiré. Refaites une demande.");
    await pool.query(
      `update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) where id = $1`,
      [userId, await hashPassword(body.password)],
    );
    await revokeAllSessions(pool, userId);
    const session = await createSession(pool, { userId, ip: clientIp(c), userAgent: c.req.header("user-agent") });
    setSessionCookie(c, session.rawToken, session.expiresAt);
    return c.json({ ok: true });
  });

  app.get("/me", requireUser, async (c) => {
    const user = currentUser(c);
    const memberships = await listMemberships(getPool(), user.id);
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        email_verified: !!user.email_verified_at,
        is_staff: user.is_staff,
        impersonated: !!user.impersonator_user_id,
      },
      workspaces: memberships.map((m) => ({
        id: m.tenant_id,
        name: m.display_name,
        role: m.role,
        profession: m.profession,
        onboarded: !!m.onboarding_completed_at,
      })),
    });
  });

  app.patch("/me", requireUser, async (c) => {
    const user = currentUser(c);
    const body = await parse(
      z.object({ name: z.string().trim().min(2).max(120).optional(), locale: z.enum(["fr", "en"]).optional() }),
      c.req,
    );
    await getPool().query(
      `update users set name = coalesce($2, name), locale = coalesce($3, locale) where id = $1`,
      [user.id, body.name ?? null, body.locale ?? null],
    );
    return c.json({ ok: true });
  });

  app.post("/password/change", requireUser, async (c) => {
    const user = currentUser(c);
    const body = await parse(z.object({ current: z.string().max(200), next: z.string() }), c.req);
    const pool = getPool();
    const row = await findUserById(pool, user.id);
    if (row?.password_hash && !(await verifyPassword(body.current, row.password_hash))) {
      throw new HttpError(400, "invalid_password", "Mot de passe actuel incorrect.");
    }
    const problem = passwordProblem(body.next);
    if (problem) throw badRequest("weak_password", problem);
    await pool.query(`update users set password_hash = $2 where id = $1`, [user.id, await hashPassword(body.next)]);
    await revokeAllSessions(pool, user.id, user.session_id);
    return c.json({ ok: true });
  });

  // Invitations ---------------------------------------------------------------
  async function loadInvitation(raw: string) {
    const res = await getPool().query<{
      id: string;
      tenant_id: string;
      email: string;
      role: "admin" | "member";
      display_name: string;
      expires_at: Date;
      accepted_at: Date | null;
      revoked_at: Date | null;
    }>(
      `select i.id, i.tenant_id, i.email, i.role, t.display_name, i.expires_at, i.accepted_at, i.revoked_at
       from invitations i join tenants t on t.tenant_id = i.tenant_id
       where i.token_hash = $1 and t.deleted_at is null`,
      [hashToken(raw)],
    );
    const inv = res.rows[0];
    if (!inv || inv.accepted_at || inv.revoked_at || new Date(inv.expires_at) < new Date()) return null;
    return inv;
  }

  app.get("/invitations/:token", async (c) => {
    const inv = await loadInvitation(c.req.param("token"));
    if (!inv) throw new HttpError(404, "invitation_invalid", "Cette invitation a expiré ou a déjà été utilisée.");
    const existing = await findUserByEmail(getPool(), inv.email);
    return c.json({ workspace: inv.display_name, email: inv.email, role: inv.role, has_account: !!existing });
  });

  app.post("/invitations/:token/accept", async (c) => {
    const inv = await loadInvitation(c.req.param("token"));
    if (!inv) throw new HttpError(404, "invitation_invalid", "Cette invitation a expiré ou a déjà été utilisée.");
    const body = await parse(
      z.object({ name: z.string().trim().min(2).max(120).optional(), password: z.string().optional() }),
      c.req,
    );
    const pool = getPool();
    const loggedIn = c.get("user");
    let userId: string;
    if (loggedIn) {
      if (loggedIn.email.toLowerCase() !== inv.email.toLowerCase()) {
        throw new HttpError(403, "invitation_email_mismatch", `Cette invitation est destinée à ${inv.email}.`);
      }
      userId = loggedIn.id;
    } else {
      const existing = await findUserByEmail(pool, inv.email);
      if (existing) {
        throw new HttpError(401, "login_required", "Connectez-vous avec ce compte pour accepter l'invitation.");
      }
      const problem = passwordProblem(body.password ?? "");
      if (problem) throw badRequest("weak_password", problem);
      if (!body.name) throw badRequest("name_required", "Indiquez votre nom.");
      const u = await pool.query<{ id: string }>(
        `insert into users (email, password_hash, name, email_verified_at) values ($1, $2, $3, now()) returning id`,
        [inv.email, await hashPassword(body.password!), body.name],
      );
      userId = u.rows[0]!.id;
    }
    await withTransaction(pool, async (db) => {
      await db.query(
        `insert into memberships (tenant_id, user_id, role) values ($1, $2, $3) on conflict do nothing`,
        [inv.tenant_id, userId, inv.role],
      );
      await db.query(`update invitations set accepted_at = now() where id = $1`, [inv.id]);
      await audit(db, {
        tenantId: inv.tenant_id,
        actor: inv.email,
        step: "team",
        decision: "invitation_accepted",
        summary: { role: inv.role },
      });
    });
    if (!loggedIn) {
      const session = await createSession(pool, { userId, ip: clientIp(c), userAgent: c.req.header("user-agent") });
      setSessionCookie(c, session.rawToken, session.expiresAt);
    }
    return c.json({ ok: true, workspace: inv.tenant_id });
  });

  return app;
}
