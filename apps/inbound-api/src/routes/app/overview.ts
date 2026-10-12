import { readAllUsage } from "@kanso/billing";
import { getPool, loadPublishedConfig } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { body } from "../../http/body.js";
import type { AppEnv } from "../../http/types.js";

export function serializeEntitlements(ent: ReturnType<typeof currentWorkspace>["entitlements"]) {
  return {
    plan: ent.plan.id,
    plan_name: ent.plan.name,
    status: ent.status,
    active: ent.active,
    trial_ends_at: ent.trialEndsAt,
    trial_days_left: ent.trialDaysLeft,
    modules: ent.modules,
    quotas: ent.quotas,
    seats: ent.seats,
    cancel_at_period_end: ent.subscription?.cancel_at_period_end ?? false,
    current_period_end: ent.subscription?.current_period_end ?? null,
    has_stripe_customer: !!ent.subscription?.stripe_customer_id,
  };
}

export function overviewRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const pool = getPool();
    const [tenant, usage, published, docPublished, keys, leadStats, pendingDocs, unread, dpa] = await Promise.all([
      pool.query<{ onboarding_step: number; onboarding_completed_at: Date | null; created_at: Date; dpa_signed: boolean }>(
        `select onboarding_step, onboarding_completed_at, created_at, dpa_signed from tenants where tenant_id = $1`,
        [ws.tenantId],
      ),
      readAllUsage(pool, ws.tenantId),
      loadPublishedConfig(pool, ws.tenantId, "inbound"),
      loadPublishedConfig(pool, ws.tenantId, "document_to_action"),
      pool.query<{ last_seen_at: Date | null; last_seen_origin: string | null; allowed_origins: string[] }>(
        `select last_seen_at, last_seen_origin, allowed_origins from widget_keys
         where tenant_id = $1 and revoked_at is null order by created_at desc limit 1`,
        [ws.tenantId],
      ),
      pool.query<{ total: string; hot: string; new_count: string; last7: string }>(
        `select count(*)::text as total,
                count(*) filter (where tier = 'hot')::text as hot,
                count(*) filter (where status = 'new')::text as new_count,
                count(*) filter (where created_at > now() - interval '7 days')::text as last7
         from leads where tenant_id = $1 and created_at > date_trunc('month', now())`,
        [ws.tenantId],
      ),
      pool.query<{ n: string }>(
        `select count(*)::text as n from document_jobs where tenant_id = $1 and review_status = 'pending_review'`,
        [ws.tenantId],
      ),
      pool.query<{ n: string }>(
        `select count(*)::text as n from notifications
         where tenant_id = $1 and read_at is null and (user_id is null or user_id = $2)`,
        [ws.tenantId, currentUser(c).id],
      ),
      pool.query(`select 1 from dpa_acceptances where tenant_id = $1 limit 1`, [ws.tenantId]),
    ]);
    const t = tenant.rows[0]!;
    const key = keys.rows[0];
    const ls = leadStats.rows[0]!;
    return c.json({
      workspace: {
        id: ws.tenantId,
        name: ws.displayName,
        role: ws.role,
        profession: ws.profession,
        created_at: t.created_at,
        onboarding_step: t.onboarding_step,
        onboarded: !!t.onboarding_completed_at,
      },
      entitlements: serializeEntitlements(ws.entitlements),
      usage,
      assistant: {
        published: !!published,
        version: published?.version ?? null,
        published_at: published?.published_at ?? null,
        installed: !!key?.last_seen_at,
        last_seen_at: key?.last_seen_at ?? null,
        last_seen_origin: key?.last_seen_origin ?? null,
        origins_restricted: (key?.allowed_origins.length ?? 0) > 0,
      },
      documents: {
        published: !!docPublished,
        pending_review: Number(pendingDocs.rows[0]?.n ?? 0),
        dpa_accepted: t.dpa_signed || (dpa.rowCount ?? 0) > 0,
      },
      leads_this_month: {
        total: Number(ls.total),
        hot: Number(ls.hot),
        new: Number(ls.new_count),
        last_7_days: Number(ls.last7),
      },
      unread_notifications: Number(unread.rows[0]?.n ?? 0),
    });
  });

  app.get("/activity", async (c) => {
    const ws = currentWorkspace(c);
    const res = await getPool().query<{ day: string; leads: string; hot: string }>(
      `select to_char(d, 'YYYY-MM-DD') as day,
              count(l.id)::text as leads,
              count(l.id) filter (where l.tier = 'hot')::text as hot
       from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
       left join leads l on l.tenant_id = $1 and date_trunc('day', l.created_at) = d
       group by d order by d`,
      [ws.tenantId],
    );
    return c.json({ days: res.rows.map((r) => ({ day: r.day, leads: Number(r.leads), hot: Number(r.hot) })) });
  });

  app.patch("/onboarding", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(c.req, z.object({ step: z.number().int().min(0).max(10).optional(), completed: z.boolean().optional() }));
    await getPool().query(
      `update tenants set onboarding_step = greatest(onboarding_step, coalesce($2, onboarding_step)),
         onboarding_completed_at = case when $3::boolean then coalesce(onboarding_completed_at, now()) else onboarding_completed_at end
       where tenant_id = $1`,
      [ws.tenantId, b.step ?? null, b.completed ?? false],
    );
    return c.json({ ok: true });
  });

  app.patch("/", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(
      c.req,
      z.object({
        name: z.string().trim().min(2).max(80).optional(),
        modules: z.object({ inbound: z.boolean(), document_to_action: z.boolean() }).partial().optional(),
      }),
    );
    const pool = getPool();
    if (b.name) await pool.query(`update tenants set display_name = $2 where tenant_id = $1`, [ws.tenantId, b.name]);
    if (b.modules) {
      await pool.query(`update tenants set modules = modules || $2::jsonb where tenant_id = $1`, [
        ws.tenantId,
        JSON.stringify(b.modules),
      ]);
    }
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "workspace", decision: "updated", summary: b });
    return c.json({ ok: true });
  });

  app.get("/notifications", async (c) => {
    const ws = currentWorkspace(c);
    const res = await getPool().query(
      `select id, type, title, body, link, read_at, created_at from notifications
       where tenant_id = $1 and (user_id is null or user_id = $2)
       order by created_at desc limit 30`,
      [ws.tenantId, currentUser(c).id],
    );
    return c.json({ notifications: res.rows });
  });

  app.post("/notifications/read", async (c) => {
    const ws = currentWorkspace(c);
    await getPool().query(
      `update notifications set read_at = now() where tenant_id = $1 and read_at is null and (user_id is null or user_id = $2)`,
      [ws.tenantId, currentUser(c).id],
    );
    return c.json({ ok: true });
  });

  return app;
}
