import { readUsage } from "@kanso/billing";
import { AI_TERMS_VERSION, aiEffective } from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { body } from "../../http/body.js";
import { badRequest, forbidden } from "../../http/errors.js";
import type { AppEnv } from "../../http/types.js";

type AiSettings = { ai_enabled: boolean; ai_terms_version: string | null; ai_accepted_at: Date | null };

export async function loadAiSettings(tenantId: string): Promise<AiSettings | undefined> {
  const r = await getPool().query<AiSettings>(
    `select ai_enabled, ai_terms_version, ai_accepted_at from portal_settings where tenant_id = $1`,
    [tenantId],
  );
  return r.rows[0];
}

/** Monté sous /portail/ai : hérite des contrôles module + abonnement du Portail. */
export function portailAiRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const s = await loadAiSettings(ws.tenantId);
    return c.json({
      entitled: ws.entitlements.quotas.ai_pages > 0,
      enabled: aiEffective(s),
      terms_version: AI_TERMS_VERSION,
      accepted_version: s?.ai_terms_version ?? null,
      accepted_at: s?.ai_accepted_at ?? null,
      usage: { used: await readUsage(getPool(), ws.tenantId, "ai_pages"), limit: ws.entitlements.quotas.ai_pages },
    });
  });

  app.put("/", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    const b = await body(c.req, z.object({ enabled: z.boolean(), accept_terms: z.string().max(40).optional() }));
    const pool = getPool();
    if (b.enabled) {
      if (ws.entitlements.quotas.ai_pages <= 0) throw forbidden("ai_not_in_plan", "L'analyse IA est incluse dans l'offre Portail Cabinet.");
      if (b.accept_terms !== AI_TERMS_VERSION) throw badRequest("ai_terms_required", "Acceptez l'avenant « Analyse IA » pour activer la fonction.");
      await pool.query(
        `update portal_settings set ai_enabled = true, ai_terms_version = $2, ai_accepted_by = $3, ai_accepted_at = now(), updated_at = now()
         where tenant_id = $1`,
        [ws.tenantId, AI_TERMS_VERSION, currentUser(c).id],
      );
    } else {
      await pool.query(`update portal_settings set ai_enabled = false, updated_at = now() where tenant_id = $1`, [ws.tenantId]);
      // Data minimisation: extracted texts only exist while the feature is on.
      await pool.query(`delete from portal_file_texts where tenant_id = $1`, [ws.tenantId]);
    }
    await audit(pool, {
      tenantId: ws.tenantId,
      actor: actorLabel(c),
      step: "portail.ai",
      decision: b.enabled ? "enabled" : "disabled",
      summary: b.enabled ? { terms_version: AI_TERMS_VERSION } : {},
    });
    return c.json({ ok: true });
  });

  return app;
}
