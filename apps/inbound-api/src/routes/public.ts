import { PAID_PLANS, PLANS, TRIAL_DAYS } from "@kanso/billing";
import { PROFESSIONS, parseInboundConfig } from "@kanso/config";
import { getPool, loadPublishedConfig } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { templates } from "@kanso/mailer";
import { apiPublicUrl, appUrl } from "../env.js";
import { badRequest } from "../http/errors.js";
import { body } from "../http/body.js";
import { deliver } from "../services/mail.js";
import { notFound } from "../http/errors.js";
import type { RateLimiter } from "../http/rate-limit.js";
import { rateLimit } from "../http/rate-limit.js";
import type { AppEnv } from "../http/types.js";
import { DEMO_TENANT, ensureDemoTenant } from "../services/demo.js";
import type { InboundDeps } from "../services/inbound.js";
import { labelledAnswers, tierFor } from "../services/leads.js";

export function publicRoutes(limiter: RateLimiter, _deps: InboundDeps = {}) {
  const app = new Hono<AppEnv>();

  app.get("/plans", (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ trial_days: TRIAL_DAYS, trial: PLANS.trial, plans: PAID_PLANS.map((id) => PLANS[id]) });
  });

  /** Public forms of the vitrine sites: contact, quote (Kanso Site), waiting list (Kanso Portail). */
  const PRODUCT = {
    solutions: "Kanso Solutions",
    assistant: "Kanso Assistant",
    site: "Kanso Site",
    portail: "Kanso Portail",
  } as const;
  const ContactBody = z.object({
    source: z.enum(["solutions", "assistant", "site", "portail"]),
    kind: z.enum(["contact", "devis", "waitlist"]).default("contact"),
    name: z.string().trim().max(120).default(""),
    email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(200),
    phone: z.string().trim().max(30).optional(),
    profession: z.enum(["avocat", "expert_comptable", "notaire", "autre"]).optional(),
    organisation: z.string().trim().max(120).optional(),
    message: z.string().trim().max(3000).optional(),
    extra: z
      .object({
        project: z.enum(["creation", "refonte"]).optional(),
        current_url: z.string().trim().max(200).optional(),
        timeline: z.enum(["asap", "1_3_mois", "flexible"]).optional(),
        with_assistant: z.boolean().optional(),
      })
      .default({}),
    consent: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter le traitement de votre demande." }) }),
    /** Honeypot: real visitors never fill it. */
    website: z.string().max(0).optional(),
  });

  app.post(
    "/contact",
    rateLimit(limiter, { name: "public_contact", limit: 5, windowSec: 600 }),
    async (c) => {
      const raw = await c.req.json().catch(() => ({}));
      // Bots that fill the honeypot get a silent success.
      if (typeof (raw as { website?: unknown }).website === "string" && (raw as { website: string }).website.length > 0) {
        return c.json({ ok: true });
      }
      const b = await body({ json: async () => raw }, ContactBody);
      if (b.kind === "devis" && b.source !== "site") throw badRequest("invalid_kind");
      if (b.kind === "waitlist" && b.source !== "portail") throw badRequest("invalid_kind");
      if (b.kind !== "waitlist" && !b.name) throw badRequest("name_required", "Indiquez votre nom.");
      const pool = getPool();
      const dup = await pool.query(
        `select 1 from contact_requests where email = $1 and source = $2 and kind = $3 and created_at > now() - interval '1 day'`,
        [b.email, b.source, b.kind],
      );
      if ((dup.rowCount ?? 0) === 0) {
        const res = await pool.query<{ id: string }>(
          `insert into contact_requests (source, kind, name, email, phone, profession, organisation, message, extra)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) returning id`,
          [b.source, b.kind, b.name, b.email, b.phone ?? null, b.profession ?? null, b.organisation ?? null, b.message ?? null, JSON.stringify(b.extra)],
        );
        const TIMELINE: Record<string, string> = { asap: "Au plus vite", "1_3_mois": "Dans 1 à 3 mois", flexible: "Pas de contrainte" };
        const rows: Array<[string, string]> = [
          ["Nom", b.name || "—"],
          ["E-mail", b.email],
          ...(b.phone ? ([["Téléphone", b.phone]] as Array<[string, string]>) : []),
          ...(b.profession ? ([["Profession", b.profession]] as Array<[string, string]>) : []),
          ...(b.organisation ? ([["Structure", b.organisation]] as Array<[string, string]>) : []),
          ...(b.extra.project ? ([["Projet", b.extra.project === "refonte" ? "Refonte" : "Création"]] as Array<[string, string]>) : []),
          ...(b.extra.current_url ? ([["Site actuel", b.extra.current_url]] as Array<[string, string]>) : []),
          ...(b.extra.timeline ? ([["Échéance", TIMELINE[b.extra.timeline]!]] as Array<[string, string]>) : []),
          ...(b.extra.with_assistant ? ([["Souhaite Kanso Assistant", "oui"]] as Array<[string, string]>) : []),
          ...(b.message ? ([["Message", b.message]] as Array<[string, string]>) : []),
        ];
        const label = b.kind === "devis" ? "Devis" : b.kind === "waitlist" ? "Liste d'attente" : "Contact";
        await deliver(
          process.env.KANSO_SALES_EMAIL ?? "bonjour@kanso.fr",
          templates.internalRequest({
            kind: `${label} — ${PRODUCT[b.source]}`,
            workspace: b.name || b.email,
            tenantId: b.source,
            requester: b.email,
            rows,
            url: `${appUrl()}/admin/demandes#${res.rows[0]!.id}`,
          }),
        );
        await deliver(b.email, templates.contactAck({ name: b.name.split(" ")[0] ?? "", product: PRODUCT[b.source], kind: b.kind }));
      }
      // Same answer whether or not it was a duplicate (no enumeration, no spam amplification).
      return c.json({ ok: true });
    },
  );

  app.get("/professions", (c) => c.json({ professions: PROFESSIONS }));

  app.get("/demo", async (c) => {
    const { publicKey } = await ensureDemoTenant();
    return c.json({ public_key: publicKey, api_url: apiPublicUrl(), script_url: `${apiPublicUrl()}/widget/kanso-widget.js` });
  });

  /** "Ce que reçoit le cabinet" — only for demo sessions, scoped by session id. */
  app.get(
    "/demo/sessions/:id",
    rateLimit(limiter, { name: "demo_peek", limit: 60, windowSec: 60 }),
    async (c) => {
      const id = z.string().uuid().safeParse(c.req.param("id"));
      if (!id.success) throw notFound();
      const pool = getPool();
      const res = await pool.query<{
        state: string;
        answers: Record<string, unknown>;
        score_current: number;
        score_final: number | null;
      }>(`select state, answers, score_current, score_final from inbound_sessions where id = $1 and tenant_id = $2`, [
        id.data,
        DEMO_TENANT,
      ]);
      const s = res.rows[0];
      if (!s) throw notFound();
      const published = await loadPublishedConfig(pool, DEMO_TENANT, "inbound");
      const config = parseInboundConfig(published!.config);
      const score = s.score_final ?? s.score_current;
      return c.json({
        state: s.state,
        closed: s.state.startsWith("Closed"),
        score,
        tier: tierFor(config, score),
        thresholds: config.scoring.thresholds,
        answers: labelledAnswers(config, s.answers).map(([label, value]) => ({ label, value })),
        total_questions: config.qualification.questions.filter((q) => q.required).length,
      });
    },
  );

  return app;
}
