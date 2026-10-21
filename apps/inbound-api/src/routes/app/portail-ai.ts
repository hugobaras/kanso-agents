import { readUsage } from "@kanso/billing";
import { AI_TERMS_VERSION, aiEffective, sanitizeAnswer, sanitizeCheck, sanitizeSummary } from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { actorLabel, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { body } from "../../http/body.js";
import { badRequest, forbidden, HttpError, notFound } from "../../http/errors.js";
import { rateLimit, type RateLimiter } from "../../http/rate-limit.js";
import type { AppEnv } from "../../http/types.js";
import { loadDossierForAi, portailAnalyst } from "../../services/portail-ai.js";
import { ensureSettings } from "./portail.js";

type AiSettings = { ai_enabled: boolean; ai_terms_version: string | null; ai_accepted_at: Date | null };

export async function loadAiSettings(tenantId: string): Promise<AiSettings | undefined> {
  const r = await getPool().query<AiSettings>(
    `select ai_enabled, ai_terms_version, ai_accepted_at from portal_settings where tenant_id = $1`,
    [tenantId],
  );
  return r.rows[0];
}

/** Monté sous /portail/ai : hérite des contrôles module + abonnement du Portail. */
export function portailAiRoutes(limiter: RateLimiter) {
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
    // Settings rows are created lazily: without this the update below would silently match nothing.
    await ensureSettings(ws.tenantId);
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

  // ---- Analyse d'un dossier : rien n'est conservé, chaque usage est tracé (sans contenu) ----
  const analysis = new Hono<AppEnv>();
  analysis.use(
    "*",
    rateLimit(limiter, { name: "portail-ai", limit: 30, windowSec: 3600, key: (c) => `${currentWorkspace(c).tenantId}:${currentUser(c).id}` }),
  );

  async function prepare(c: Context<AppEnv>, kind: string) {
    const ws = currentWorkspace(c);
    if (!aiEffective(await loadAiSettings(ws.tenantId))) throw new HttpError(409, "ai_disabled", "L'analyse IA n'est pas activée pour cet espace.");
    const id = c.req.param("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("dossier_not_found");
    const d = await getPool().query<{ ai_excluded: boolean }>(`select ai_excluded from portal_dossiers where id = $1 and tenant_id = $2`, [id, ws.tenantId]);
    if (!d.rows[0]) throw notFound("dossier_not_found");
    if (d.rows[0].ai_excluded) throw new HttpError(409, "ai_excluded", "Ce dossier est exclu de l'analyse IA.");
    const data = await loadDossierForAi(ws.tenantId, id);
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.ai", decision: kind, summary: { dossier: id, files: data.coverage.analyzed } });
    return { ...data, ...portailAnalyst() };
  }

  const meta = (simulated: boolean, coverage: unknown) => ({
    simulated,
    coverage,
    notice: "Suggestions générées automatiquement à partir des pièces : à vérifier, elles ne remplacent pas votre analyse.",
  });

  analysis.post("/dossiers/:id/summary", async (c) => {
    const { docs, coverage, analyst, simulated } = await prepare(c, "summary");
    const result = docs.length ? sanitizeSummary(await analyst.summarize(docs), docs) : { overview: "Aucune pièce analysée pour le moment.", pieces: [] };
    return c.json({ ...meta(simulated, coverage), result });
  });

  analysis.post("/dossiers/:id/check", async (c) => {
    const { docs, items, coverage, analyst, simulated } = await prepare(c, "check");
    return c.json({ ...meta(simulated, coverage), result: sanitizeCheck(await analyst.check(items, docs), docs) });
  });

  analysis.post("/dossiers/:id/ask", async (c) => {
    const b = await body(c.req, z.object({ question: z.string().trim().min(3).max(500) }));
    const { docs, coverage, analyst, simulated } = await prepare(c, "ask");
    const raw = docs.length ? await analyst.ask(b.question, docs) : { found: false, answer: "", citations: [] };
    return c.json({ ...meta(simulated, coverage), result: sanitizeAnswer(raw, docs) });
  });

  app.route("/", analysis);
  return app;
}
