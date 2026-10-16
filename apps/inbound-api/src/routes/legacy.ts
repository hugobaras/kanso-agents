import { consumeQuota, getEntitlements } from "@kanso/billing";
import { parseDocumentToActionConfig } from "@kanso/config";
import { enqueueUploadJob, sniffMime } from "@kanso/document-pipeline";
import { getPool, loadPublishedConfig, requireTenantId } from "@kanso/tenancy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "../http/types.js";
import { runInboundTurn, startInboundSession, type InboundDeps } from "../services/inbound.js";
import { assertDocumentUploadAllowed } from "../dpa-gate.js";

/**
 * D-131: pre-SaaS widget API keyed by tenant slug (pilotes). Enabled only with
 * KANSO_LEGACY_WIDGET=1 while design partners migrate to `data-key`.
 */
export function legacyRoutes(deps: InboundDeps = {}) {
  const app = new Hono<AppEnv>();
  app.use("/v1/:tenantId/*", cors({ origin: (o) => o || "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type"] }));

  app.post("/v1/:tenantId/sessions", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const started = await startInboundSession(tenantId, deps, { origin: c.req.header("origin") ?? null });
    if (!started.ok) {
      return c.json({ error: started.error }, started.error === "no_published_inbound_config" ? 404 : 503);
    }
    return c.json({
      session_id: started.sessionId,
      state: started.state,
      assistant_message: started.assistantMessage,
      after_hours: started.afterHours,
      expected_question: started.expectedQuestion,
    });
  });

  app.post("/v1/:tenantId/sessions/:sessionId/messages", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const body = (await c.req.json().catch(() => ({}))) as { text?: string };
    if (!body.text?.trim()) return c.json({ error: "text_required" }, 400);
    const out = await runInboundTurn(tenantId, c.req.param("sessionId"), body.text.slice(0, 2000), deps);
    switch (out.kind) {
      case "not_found":
        return c.json({ error: "session_not_found" }, 404);
      case "no_config":
        return c.json({ error: "no_published_inbound_config" }, 404);
      case "after_hours":
        return c.json({ error: "after_hours", after_hours: true, assistant_message: out.assistantMessage, session_id: c.req.param("sessionId"), state: out.state }, 403);
      case "quota_exceeded":
        return c.json({ error: "quota_exceeded", assistant_message: out.assistantMessage }, 429);
      case "unavailable":
        return c.json({ error: "unavailable", assistant_message: out.assistantMessage }, 503);
      case "ok":
        return c.json({
          session_id: out.sessionId,
          state: out.state,
          score_current: out.scoreCurrent,
          score_final: out.scoreFinal,
          score_band: out.scoreBand,
          score_thresholds: out.thresholds,
          answers: out.answers,
          intent: out.intent,
          alert_event: out.alertEvent,
          alert: out.alert,
          integrations: out.integrations,
          assistant_message: out.assistantMessage,
          expected_question: out.expectedQuestion,
          tenant_display_name: out.displayName,
          llm_provider: out.llmProvider,
          usage: out.usage,
        });
    }
  });

  app.post("/v1/:tenantId/documents", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const body = (await c.req.json().catch(() => ({}))) as { content_base64?: string; filename?: string };
    if (!body.content_base64) return c.json({ error: "content_base64_required" }, 400);
    const content = Buffer.from(body.content_base64, "base64");
    if (content.length === 0) return c.json({ error: "empty_content" }, 400);
    if (content.length > 10 * 1024 * 1024) return c.json({ error: "file_too_large" }, 413);
    const gate = await assertDocumentUploadAllowed({ tenantId, content, filename: body.filename });
    if (!gate.allowed) return c.json({ error: gate.error }, 403);
    const pool = getPool();
    const published = await loadPublishedConfig(pool, tenantId, "document_to_action");
    if (!published) return c.json({ error: "no_published_document_config" }, 404);
    parseDocumentToActionConfig(published.config);
    const ent = await getEntitlements(pool, tenantId);
    if (!ent.active || !ent.modules.document_to_action) return c.json({ error: "unavailable" }, 503);
    const quota = await consumeQuota(pool, tenantId, "documents", ent.quotas.documents);
    if (!quota.ok) return c.json({ error: "quota_exceeded" }, 429);
    const job = await enqueueUploadJob(pool, {
      tenantId,
      configVersion: published.version,
      content,
      filename: body.filename,
      mimeType: sniffMime(content) ?? undefined,
    });
    return c.json({ job_id: job.jobId, status: "pending", step: "ingest", content_sha256: job.contentSha256 }, 202);
  });

  app.get("/v1/:tenantId/documents/:jobId", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const res = await getPool().query(
      `select id, status, step, document_type, remote_id, last_error, review_status, created_at, updated_at, closed_at
       from document_jobs where tenant_id = $1 and id = $2::uuid`,
      [tenantId, c.req.param("jobId")],
    );
    const row = res.rows[0];
    if (!row) return c.json({ error: "job_not_found" }, 404);
    return c.json({ job_id: row.id, ...row });
  });

  return app;
}
