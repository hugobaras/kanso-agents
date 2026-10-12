import { PAID_PLANS, PLANS, TRIAL_DAYS } from "@kanso/billing";
import { PROFESSIONS, parseInboundConfig } from "@kanso/config";
import { getPool, loadPublishedConfig } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { apiPublicUrl } from "../env.js";
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
