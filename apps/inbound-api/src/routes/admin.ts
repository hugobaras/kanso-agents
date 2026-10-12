import { currentPeriod, PLANS, isPlanId } from "@kanso/billing";
import { getPool, listConfigVersions } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { csrfGuard, currentUser, requireStaff, requireUser, setSessionCookie } from "../auth/middleware.js";
import { audit, createSession } from "../auth/service.js";
import { body } from "../http/body.js";
import { notFound } from "../http/errors.js";
import { clientIp } from "../http/rate-limit.js";
import type { AppEnv } from "../http/types.js";

function mrrCents(plan: string, status: string, interval: string | null): number {
  if (!isPlanId(plan) || plan === "trial" || !["active", "past_due"].includes(status)) return 0;
  const p = PLANS[plan];
  return interval === "year" ? Math.round(p.yearlyPriceCents / 12) : p.monthlyPriceCents;
}

export function adminRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", requireUser, requireStaff, csrfGuard);

  app.get("/stats", async (c) => {
    const pool = getPool();
    const [subs, cost, signups, leads, docs] = await Promise.all([
      pool.query<{ plan: string; status: string; billing_interval: string | null }>(
        `select s.plan, s.status, s.billing_interval from subscriptions s join tenants t on t.tenant_id = s.tenant_id where t.deleted_at is null`,
      ),
      pool.query<{ eur: string }>(
        `select coalesce(sum(estimated_eur), 0)::text as eur from usage_ledger where at > date_trunc('month', now())`,
      ),
      pool.query<{ day: string; n: string }>(
        `select to_char(d, 'YYYY-MM-DD') as day, count(t.tenant_id)::text as n
         from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
         left join tenants t on date_trunc('day', t.created_at) = d group by d order by d`,
      ),
      pool.query<{ n: string }>(`select count(*)::text as n from leads where created_at > date_trunc('month', now())`),
      pool.query<{ n: string }>(`select count(*)::text as n from document_jobs where created_at > date_trunc('month', now())`),
    ]);
    const byPlan: Record<string, number> = {};
    let mrr = 0;
    let trialing = 0;
    for (const s of subs.rows) {
      byPlan[s.plan] = (byPlan[s.plan] ?? 0) + 1;
      mrr += mrrCents(s.plan, s.status, s.billing_interval);
      if (s.status === "trialing") trialing++;
    }
    return c.json({
      mrr_cents: mrr,
      workspaces: subs.rows.length,
      trialing,
      by_plan: byPlan,
      llm_cost_eur_month: Number(cost.rows[0]?.eur ?? 0),
      leads_month: Number(leads.rows[0]?.n ?? 0),
      documents_month: Number(docs.rows[0]?.n ?? 0),
      signups_30d: signups.rows.map((r) => ({ day: r.day, count: Number(r.n) })),
    });
  });

  app.get("/tenants", async (c) => {
    const q = z.object({ q: z.string().trim().max(80).optional() }).parse(c.req.query());
    const period = currentPeriod();
    const res = await getPool().query(
      `select t.tenant_id, t.display_name, t.status, t.profession, t.created_at, t.deleted_at,
              s.plan, s.status as sub_status, s.billing_interval, s.trial_ends_at,
              coalesce(uc.count, 0) as conversations_month,
              coalesce(ud.count, 0) as documents_month,
              (select count(*) from memberships m where m.tenant_id = t.tenant_id) as members,
              (select max(last_activity_at) from inbound_sessions i where i.tenant_id = t.tenant_id) as last_activity,
              (select coalesce(sum(estimated_eur), 0) from usage_ledger u where u.tenant_id = t.tenant_id and u.at > date_trunc('month', now())) as llm_eur
       from tenants t
       left join subscriptions s on s.tenant_id = t.tenant_id
       left join usage_counters uc on uc.tenant_id = t.tenant_id and uc.metric = 'conversations' and uc.period = $1
       left join usage_counters ud on ud.tenant_id = t.tenant_id and ud.metric = 'documents' and ud.period = $1
       where ($2::text is null or t.tenant_id ilike '%' || $2 || '%' or t.display_name ilike '%' || $2 || '%')
       order by t.created_at desc limit 200`,
      [period, q.q ?? null],
    );
    return c.json({
      tenants: res.rows.map((r) => ({
        ...r,
        llm_eur: Number(r.llm_eur),
        members: Number(r.members),
        mrr_cents: mrrCents(r.plan ?? "trial", r.sub_status ?? "", r.billing_interval),
      })),
    });
  });

  app.get("/tenants/:id", async (c) => {
    const id = c.req.param("id");
    const pool = getPool();
    const t = await pool.query(`select * from tenants where tenant_id = $1`, [id]);
    if (!t.rows[0]) throw notFound("tenant_not_found");
    const [members, sub, versions, dead, auditRows, keys] = await Promise.all([
      pool.query(
        `select u.id, u.email, u.name, m.role, u.last_login_at from memberships m join users u on u.id = m.user_id where m.tenant_id = $1`,
        [id],
      ),
      pool.query(`select * from subscriptions where tenant_id = $1`, [id]),
      listConfigVersions(pool, id, "inbound", 10),
      pool.query(`select id, category, provider, last_error, created_at from adapter_dead_letters where tenant_id = $1 and resolved_at is null order by created_at desc limit 20`, [id]),
      pool.query(`select at, step, decision, actor from audit_events where tenant_id = $1 order by at desc limit 50`, [id]),
      pool.query(`select public_key, allowed_origins, last_seen_at, last_seen_origin, revoked_at from widget_keys where tenant_id = $1 order by created_at desc`, [id]),
    ]);
    return c.json({
      tenant: t.rows[0],
      members: members.rows,
      subscription: sub.rows[0] ?? null,
      versions,
      dead_letters: dead.rows,
      audit: auditRows.rows,
      widget_keys: keys.rows,
    });
  });

  app.post("/tenants/:id/suspend", async (c) => {
    const id = c.req.param("id");
    const b = await body(c.req, z.object({ suspended: z.boolean(), reason: z.string().max(200).optional() }));
    const pool = getPool();
    await pool.query(
      `update tenants set status = $2, suspended_reason = $3 where tenant_id = $1`,
      [id, b.suspended ? "suspended" : "active", b.suspended ? b.reason ?? "admin" : null],
    );
    await audit(pool, { tenantId: id, actor: `staff:${currentUser(c).email}`, step: "admin", decision: b.suspended ? "suspended" : "unsuspended" });
    return c.json({ ok: true });
  });

  app.post("/tenants/:id/extend-trial", async (c) => {
    const id = c.req.param("id");
    const b = await body(c.req, z.object({ days: z.number().int().min(1).max(60) }));
    const pool = getPool();
    const res = await pool.query(
      `update subscriptions set plan = 'trial', status = 'trialing',
         trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + ($2::text || ' days')::interval, updated_at = now()
       where tenant_id = $1 and stripe_subscription_id is null returning tenant_id`,
      [id, String(b.days)],
    );
    if (res.rowCount === 0) throw notFound("no_trial_to_extend");
    await audit(pool, { tenantId: id, actor: `staff:${currentUser(c).email}`, step: "admin", decision: "trial_extended", summary: { days: b.days } });
    return c.json({ ok: true });
  });

  /** Support session as the workspace owner: 24 h, no staff powers, audited. */
  app.post("/tenants/:id/impersonate", async (c) => {
    const id = c.req.param("id");
    const pool = getPool();
    const owner = await pool.query<{ user_id: string }>(
      `select user_id from memberships where tenant_id = $1 and role = 'owner' order by created_at limit 1`,
      [id],
    );
    if (!owner.rows[0]) throw notFound("owner_not_found");
    const staff = currentUser(c);
    const session = await createSession(pool, {
      userId: owner.rows[0].user_id,
      ip: clientIp(c),
      userAgent: c.req.header("user-agent"),
      impersonatorUserId: staff.id,
    });
    await audit(pool, { tenantId: id, actor: `staff:${staff.email}`, step: "admin", decision: "impersonation_started" });
    setSessionCookie(c, session.rawToken, session.expiresAt);
    return c.json({ ok: true, workspace: id });
  });

  app.get("/requests", async (c) => {
    const res = await getPool().query(
      `select r.id, r.tenant_id, t.display_name, r.platform, r.title, r.description, r.status, r.created_at
       from custom_integration_requests r join tenants t on t.tenant_id = r.tenant_id
       order by (r.status = 'open') desc, r.created_at desc limit 100`,
    );
    return c.json({ requests: res.rows });
  });

  app.patch("/requests/:id", async (c) => {
    const b = await body(c.req, z.object({ status: z.enum(["open", "in_progress", "done", "declined"]) }));
    await getPool().query(`update custom_integration_requests set status = $2, updated_at = now() where id = $1::uuid`, [
      z.string().uuid().parse(c.req.param("id")),
      b.status,
    ]);
    return c.json({ ok: true });
  });

  app.get("/health", async (c) => {
    const pool = getPool();
    const [beats, queue] = await Promise.all([
      pool.query(`select service, at, meta from service_heartbeats order by service`),
      pool.query<{ status: string; n: string }>(`select status, count(*)::text as n from document_jobs where created_at > now() - interval '7 days' group by status`),
    ]);
    return c.json({
      heartbeats: beats.rows,
      document_queue: Object.fromEntries(queue.rows.map((r) => [r.status, Number(r.n)])),
    });
  });

  return app;
}
