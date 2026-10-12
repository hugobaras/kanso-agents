import { getPool, readExportFile, RETENTION_DAYS } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { body } from "../../http/body.js";
import { badRequest, HttpError, notFound } from "../../http/errors.js";
import { clientIp } from "../../http/rate-limit.js";
import type { AppEnv } from "../../http/types.js";

/** Bump when docs/legal/dpa changes materially; customers re-accept. */
export const DPA_VERSION = "2026-10";

export const SUBPROCESSORS = [
  { name: "OVHcloud", role: "Hébergement applicatif", location: "France (UE)" },
  { name: "Supabase (AWS eu-west)", role: "Base de données et stockage", location: "Irlande (UE)" },
  { name: "Mistral AI", role: "Modèles de langage (API UE)", location: "France (UE)" },
  { name: "Stripe", role: "Paiement et facturation", location: "Irlande (UE)" },
];

export function settingsRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/privacy", async (c) => {
    const ws = currentWorkspace(c);
    const pool = getPool();
    const [dpa, requests, deletion] = await Promise.all([
      pool.query<{ version: string; accepted_at: Date; name: string | null; email: string | null }>(
        `select d.version, d.accepted_at, u.name, u.email from dpa_acceptances d
         left join users u on u.id = d.user_id where d.tenant_id = $1 order by d.accepted_at desc limit 1`,
        [ws.tenantId],
      ),
      pool.query(
        `select id, kind, status, created_at, completed_at, error from data_requests
         where tenant_id = $1 order by created_at desc limit 10`,
        [ws.tenantId],
      ),
      pool.query<{ deleted_at: Date | null }>(`select deleted_at from tenants where tenant_id = $1`, [ws.tenantId]),
    ]);
    const last = dpa.rows[0];
    return c.json({
      dpa: {
        current_version: DPA_VERSION,
        accepted: !!last,
        up_to_date: last?.version === DPA_VERSION,
        accepted_version: last?.version ?? null,
        accepted_at: last?.accepted_at ?? null,
        accepted_by: last ? last.name || last.email : null,
      },
      retention_days: {
        conversations: RETENTION_DAYS.inboundSessions,
        documents: RETENTION_DAYS.documentJobs,
        audit: RETENTION_DAYS.auditEvents,
      },
      subprocessors: SUBPROCESSORS,
      requests: requests.rows,
      scheduled_deletion_at: deletion.rows[0]?.deleted_at ?? null,
    });
  });

  app.post("/privacy/dpa", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const b = await body(c.req, z.object({ version: z.literal(DPA_VERSION), accept: z.literal(true) }));
    const pool = getPool();
    await pool.query(`insert into dpa_acceptances (tenant_id, user_id, version, ip) values ($1, $2, $3, $4)`, [
      ws.tenantId,
      currentUser(c).id,
      b.version,
      clientIp(c),
    ]);
    await pool.query(`update tenants set dpa_signed = true, dpa_signed_at = now() where tenant_id = $1`, [ws.tenantId]);
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "dpa", decision: "accepted", summary: { version: b.version } });
    return c.json({ ok: true });
  });

  app.post("/privacy/export", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const pool = getPool();
    const running = await pool.query(
      `select 1 from data_requests where tenant_id = $1 and kind = 'export' and status in ('pending', 'running')`,
      [ws.tenantId],
    );
    if ((running.rowCount ?? 0) > 0) throw badRequest("export_in_progress", "Un export est déjà en cours.");
    await pool.query(`insert into data_requests (tenant_id, kind, requested_by) values ($1, 'export', $2)`, [
      ws.tenantId,
      currentUser(c).id,
    ]);
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "rgpd", decision: "export_requested" });
    return c.json({ ok: true }, 202);
  });

  app.get("/privacy/export/:id", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const id = z.string().uuid().parse(c.req.param("id"));
    const res = await getPool().query<{ file_ref: string | null; completed_at: Date | null }>(
      `select file_ref, completed_at from data_requests
       where tenant_id = $1 and id = $2 and kind = 'export' and status = 'done'`,
      [ws.tenantId, id],
    );
    const row = res.rows[0];
    if (!row?.file_ref || !row.completed_at || Date.now() - new Date(row.completed_at).getTime() > 86_400_000) {
      throw notFound("export_expired");
    }
    const content = readExportFile(row.file_ref);
    c.header("Content-Type", "application/json; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="kanso-export-${ws.tenantId}.json"`);
    return c.body(new Uint8Array(content));
  });

  /** Soft delete with a 30-day grace period; the scheduler purges afterwards. */
  app.post("/delete", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const b = await body(c.req, z.object({ confirm: z.string() }));
    if (b.confirm.trim() !== ws.tenantId) {
      throw badRequest("confirmation_mismatch", `Saisissez « ${ws.tenantId} » pour confirmer.`);
    }
    const pool = getPool();
    await pool.query(`update tenants set deleted_at = now() + interval '30 days', status = 'suspended', suspended_reason = 'deletion_requested' where tenant_id = $1`, [ws.tenantId]);
    await pool.query(`insert into data_requests (tenant_id, kind, requested_by) values ($1, 'delete', $2)`, [
      ws.tenantId,
      currentUser(c).id,
    ]);
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "rgpd", decision: "deletion_scheduled" });
    return c.json({ ok: true });
  });

  app.post("/delete/cancel", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const res = await getPool().query(
      `update tenants set deleted_at = null, status = 'active', suspended_reason = null
       where tenant_id = $1 and deleted_at > now() returning tenant_id`,
      [ws.tenantId],
    );
    if (res.rowCount === 0) throw new HttpError(409, "nothing_to_cancel");
    return c.json({ ok: true });
  });

  return app;
}
