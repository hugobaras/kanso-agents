import { templates } from "@kanso/mailer";
import { getPool } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { hashToken, newRawToken } from "../../auth/crypto.js";
import { audit } from "../../auth/service.js";
import { body } from "../../http/body.js";
import { badRequest, HttpError, notFound } from "../../http/errors.js";
import type { AppEnv } from "../../http/types.js";
import { appLink, deliver } from "../../services/mail.js";

export function teamRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const pool = getPool();
    const [members, invites] = await Promise.all([
      pool.query(
        `select u.id, u.email, u.name, m.role, m.created_at, u.last_login_at
         from memberships m join users u on u.id = m.user_id
         where m.tenant_id = $1 order by m.created_at asc`,
        [ws.tenantId],
      ),
      pool.query(
        `select id, email, role, created_at, expires_at from invitations
         where tenant_id = $1 and accepted_at is null and revoked_at is null and expires_at > now()
         order by created_at desc`,
        [ws.tenantId],
      ),
    ]);
    return c.json({
      members: members.rows,
      invitations: invites.rows,
      seats: { used: members.rows.length + invites.rows.length, limit: ws.entitlements.seats },
      me: currentUser(c).id,
    });
  });

  app.post("/invitations", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(
      c.req,
      z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["admin", "member"]).default("member") }),
    );
    const pool = getPool();
    const seats = await pool.query<{ n: string }>(
      `select ((select count(*) from memberships where tenant_id = $1) +
               (select count(*) from invitations where tenant_id = $1 and accepted_at is null
                  and revoked_at is null and expires_at > now()))::text as n`,
      [ws.tenantId],
    );
    if (Number(seats.rows[0]?.n ?? 0) >= ws.entitlements.seats) {
      throw new HttpError(402, "seat_limit", `Votre offre inclut ${ws.entitlements.seats} utilisateurs. Passez à l'offre supérieure pour en ajouter.`);
    }
    const already = await pool.query(
      `select 1 from memberships m join users u on u.id = m.user_id where m.tenant_id = $1 and u.email = $2`,
      [ws.tenantId, b.email],
    );
    if ((already.rowCount ?? 0) > 0) throw badRequest("already_member", "Cette personne fait déjà partie de l'espace.");
    await pool.query(
      `update invitations set revoked_at = now() where tenant_id = $1 and email = $2 and accepted_at is null and revoked_at is null`,
      [ws.tenantId, b.email],
    );
    const raw = newRawToken();
    await pool.query(
      `insert into invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
       values ($1, $2, $3, $4, $5, now() + interval '7 days')`,
      [ws.tenantId, b.email, b.role, hashToken(raw), currentUser(c).id],
    );
    await deliver(
      b.email,
      templates.invitation({
        workspace: ws.displayName,
        inviter: currentUser(c).name || currentUser(c).email,
        url: appLink(`/invitation/${encodeURIComponent(raw)}`),
      }),
    );
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "team", decision: "invited", summary: { role: b.role } });
    return c.json({ ok: true }, 201);
  });

  app.delete("/invitations/:id", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    await getPool().query(`update invitations set revoked_at = now() where tenant_id = $1 and id = $2::uuid`, [
      ws.tenantId,
      z.string().uuid().parse(c.req.param("id")),
    ]);
    return c.json({ ok: true });
  });

  app.patch("/members/:userId", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const userId = z.string().uuid().parse(c.req.param("userId"));
    const b = await body(c.req, z.object({ role: z.enum(["owner", "admin", "member"]) }));
    const pool = getPool();
    if (b.role !== "owner") await assertNotLastOwner(ws.tenantId, userId);
    const res = await pool.query(`update memberships set role = $3 where tenant_id = $1 and user_id = $2`, [
      ws.tenantId,
      userId,
      b.role,
    ]);
    if (res.rowCount === 0) throw notFound("member_not_found");
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "team", decision: `role_${b.role}` });
    return c.json({ ok: true });
  });

  app.delete("/members/:userId", async (c) => {
    const ws = currentWorkspace(c);
    const userId = z.string().uuid().parse(c.req.param("userId"));
    // Members may leave; removing others requires admin.
    if (userId !== currentUser(c).id) assertRole(c, "admin");
    await assertNotLastOwner(ws.tenantId, userId);
    const pool = getPool();
    const target = await pool.query<{ role: string }>(`select role from memberships where tenant_id = $1 and user_id = $2`, [ws.tenantId, userId]);
    if (!target.rows[0]) throw notFound("member_not_found");
    if (target.rows[0].role === "owner" && ws.role !== "owner" && userId !== currentUser(c).id) {
      throw new HttpError(403, "insufficient_role", "Seul un propriétaire peut retirer un autre propriétaire.");
    }
    await pool.query(`delete from memberships where tenant_id = $1 and user_id = $2`, [ws.tenantId, userId]);
    await pool.query(`update leads set assignee_user_id = null where tenant_id = $1 and assignee_user_id = $2`, [ws.tenantId, userId]);
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "team", decision: "member_removed" });
    return c.json({ ok: true });
  });

  return app;
}

async function assertNotLastOwner(tenantId: string, userId: string) {
  const res = await getPool().query<{ owners: string; is_owner: boolean }>(
    `select count(*) filter (where role = 'owner')::text as owners,
            bool_or(user_id = $2 and role = 'owner') as is_owner
     from memberships where tenant_id = $1`,
    [tenantId, userId],
  );
  const r = res.rows[0];
  if (r?.is_owner && Number(r.owners) <= 1) {
    throw badRequest("last_owner", "L'espace doit conserver au moins un propriétaire.");
  }
}
