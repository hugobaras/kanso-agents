import { consumeQuota } from "@kanso/billing";
import {
  buildDocumentTemplate,
  DocumentToActionConfigSchema,
  parseDocumentToActionConfig,
  type DocumentToActionConfig,
} from "@kanso/config";
import { enqueueUploadJob, MAX_DOCUMENT_BYTES, readJobPayload, sniffMime } from "@kanso/document-pipeline";
import { getPool, loadDraftConfig, loadPublishedConfig, publishConfig, saveDraftConfig } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertActive, assertModule, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { body } from "../../http/body.js";
import { badRequest, forbidden, HttpError, notFound } from "../../http/errors.js";
import type { AppEnv } from "../../http/types.js";
import { notifyQuota } from "../../services/notifications.js";

const REVIEW = ["pending_review", "approved", "rejected", "auto_approved"] as const;

async function currentDocDraft(tenantId: string): Promise<DocumentToActionConfig> {
  const pool = getPool();
  const draft = await loadDraftConfig(pool, tenantId, "document_to_action");
  if (draft) {
    const parsed = DocumentToActionConfigSchema.safeParse(draft.config);
    if (parsed.success) return parsed.data;
  }
  const published = await loadPublishedConfig(pool, tenantId, "document_to_action");
  return published ? parseDocumentToActionConfig(published.config) : buildDocumentTemplate();
}

/** Ensure a published D2A config exists (publish the draft on first upload). */
async function ensurePublishedDocConfig(tenantId: string, actor: string): Promise<number> {
  const pool = getPool();
  const published = await loadPublishedConfig(pool, tenantId, "document_to_action");
  if (published) return published.version;
  const cfg = await currentDocDraft(tenantId);
  return publishConfig(pool, { tenantId, product: "document_to_action", config: cfg, publishedBy: actor });
}

async function dpaAccepted(tenantId: string): Promise<boolean> {
  const res = await getPool().query<{ ok: boolean }>(
    `select (t.dpa_signed or exists (select 1 from dpa_acceptances d where d.tenant_id = t.tenant_id)) as ok
     from tenants t where t.tenant_id = $1`,
    [tenantId],
  );
  return res.rows[0]?.ok === true;
}

type JobRow = {
  id: string;
  original_filename: string | null;
  source_item_id: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  document_type: string | null;
  step: string;
  status: string;
  review_status: string | null;
  fields: Record<string, unknown>;
  field_confidence: Record<string, number>;
  validation_results: unknown;
  remote_id: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  reviewer_name: string | null;
  uploader_name: string | null;
  extracted_text: string | null;
  page_count: number | null;
  storage_ref: string | null;
};

function publicJob(j: JobRow) {
  return {
    id: j.id,
    filename: j.original_filename ?? j.source_item_id ?? "document",
    mime_type: j.mime_type,
    size_bytes: j.size_bytes,
    document_type: j.document_type,
    step: j.step,
    status: j.status,
    review_status: j.review_status,
    anomaly: (j.validation_results as { reason?: string } | null)?.reason ?? (j.step === "anomaly" ? j.last_error : null),
    remote_id: j.remote_id,
    created_at: j.created_at,
    updated_at: j.updated_at,
    uploaded_by: j.uploader_name,
  };
}

export function documentsRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    assertModule(c, "document_to_action");
    await next();
  });

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const q = z
      .object({
        review: z.enum(REVIEW).optional(),
        status: z.enum(["pending", "running", "succeeded", "failed", "waiting_human"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        cursor: z.string().datetime().optional(),
      })
      .parse(c.req.query());
    const params: unknown[] = [ws.tenantId];
    let sql = `select j.*, ru.name as reviewer_name, uu.name as uploader_name
               from document_jobs j
               left join users ru on ru.id = j.reviewed_by
               left join users uu on uu.id = j.uploaded_by
               where j.tenant_id = $1`;
    if (q.review) {
      params.push(q.review);
      sql += ` and j.review_status = $${params.length}`;
    }
    if (q.status) {
      params.push(q.status);
      sql += ` and j.status = $${params.length}`;
    }
    if (q.cursor) {
      params.push(q.cursor);
      sql += ` and j.created_at < $${params.length}`;
    }
    params.push(q.limit + 1);
    sql += ` order by j.created_at desc limit $${params.length}`;
    const pool = getPool();
    const [res, counts] = await Promise.all([
      pool.query<JobRow>(sql, params),
      pool.query<{ pending_review: string; processing: string; done: string; month: string }>(
        `select count(*) filter (where review_status = 'pending_review')::text as pending_review,
                count(*) filter (where status in ('pending', 'running'))::text as processing,
                count(*) filter (where status = 'succeeded')::text as done,
                count(*) filter (where created_at > date_trunc('month', now()))::text as month
         from document_jobs where tenant_id = $1`,
        [ws.tenantId],
      ),
    ]);
    const items = res.rows.slice(0, q.limit);
    const ct = counts.rows[0]!;
    return c.json({
      documents: items.map(publicJob),
      next_cursor: res.rows.length > q.limit ? items[items.length - 1]!.created_at.toISOString() : null,
      counts: {
        pending_review: Number(ct.pending_review),
        processing: Number(ct.processing),
        done: Number(ct.done),
        this_month: Number(ct.month),
      },
      dpa_accepted: await dpaAccepted(ws.tenantId),
    });
  });

  app.post("/", async (c) => {
    const ws = currentWorkspace(c);
    assertActive(c);
    if (!(await dpaAccepted(ws.tenantId))) {
      throw forbidden(
        "dpa_required",
        "Acceptez l'accord de traitement des données (Paramètres › Données & RGPD) avant d'envoyer des documents.",
      );
    }
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) throw badRequest("file_required", "Ajoutez un fichier PDF ou une image.");
    if (file.size === 0) throw badRequest("empty_file", "Le fichier est vide.");
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new HttpError(413, "file_too_large", "Le fichier dépasse 10 Mo.");
    }
    const content = Buffer.from(await file.arrayBuffer());
    const mime = sniffMime(content);
    if (!mime) throw badRequest("unsupported_type", "Formats acceptés : PDF, PNG, JPEG, WebP.");

    const pool = getPool();
    const quota = await consumeQuota(pool, ws.tenantId, "documents", ws.entitlements.quotas.documents);
    await notifyQuota(ws.tenantId, "documents", quota.used, quota.limit);
    if (!quota.ok) {
      throw new HttpError(429, "quota_exceeded", `Quota mensuel de documents atteint (${quota.limit}).`);
    }
    const version = await ensurePublishedDocConfig(ws.tenantId, actorLabel(c));
    const filename = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 160) || "document";
    const job = await enqueueUploadJob(pool, {
      tenantId: ws.tenantId,
      configVersion: version,
      content,
      filename,
      mimeType: mime,
      uploadedBy: currentUser(c).id,
    });
    return c.json({ id: job.jobId, status: "pending", step: "ingest" }, 202);
  });

  app.get("/:id", async (c) => {
    const ws = currentWorkspace(c);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw notFound("document_not_found");
    const pool = getPool();
    const res = await pool.query<JobRow>(
      `select j.*, ru.name as reviewer_name, uu.name as uploader_name
       from document_jobs j
       left join users ru on ru.id = j.reviewed_by
       left join users uu on uu.id = j.uploaded_by
       where j.tenant_id = $1 and j.id = $2`,
      [ws.tenantId, id.data],
    );
    const j = res.rows[0];
    if (!j) throw notFound("document_not_found");
    const cfg = await currentDocDraft(ws.tenantId);
    const audits = await pool.query(
      `select at, step, decision, actor from audit_events where tenant_id = $1 and job_id = $2 order by at asc limit 50`,
      [ws.tenantId, id.data],
    );
    return c.json({
      document: publicJob(j),
      fields: j.fields,
      field_confidence: j.field_confidence,
      expected_fields: cfg.documents.fields_by_type[j.document_type ?? "invoice"] ?? Object.keys(j.fields),
      min_confidence: cfg.alerts.human_review.min_confidence,
      validation: j.validation_results,
      extracted_text: j.extracted_text?.slice(0, 20_000) ?? null,
      page_count: j.page_count,
      reviewed_by: j.reviewer_name,
      reviewed_at: j.reviewed_at,
      history: audits.rows,
    });
  });

  app.get("/:id/file", async (c) => {
    const ws = currentWorkspace(c);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw notFound("document_not_found");
    const res = await getPool().query<{ storage_ref: string | null; mime_type: string | null; original_filename: string | null }>(
      `select storage_ref, mime_type, original_filename from document_jobs where tenant_id = $1 and id = $2`,
      [ws.tenantId, id.data],
    );
    const row = res.rows[0];
    if (!row?.storage_ref) throw notFound("document_not_found");
    let content: Buffer;
    try {
      content = readJobPayload(row.storage_ref);
    } catch {
      throw notFound("file_purged");
    }
    const mime = sniffMime(content) ?? "application/octet-stream";
    c.header("Content-Type", mime);
    c.header("Content-Disposition", `inline; filename="${encodeURIComponent(row.original_filename ?? "document")}"`);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    c.header("Cache-Control", "private, max-age=300");
    return c.body(new Uint8Array(content));
  });

  app.post("/:id/approve", async (c) => {
    const ws = currentWorkspace(c);
    assertActive(c);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw notFound("document_not_found");
    const b = await body(c.req, z.object({ fields: z.record(z.union([z.string(), z.number(), z.null()])).optional() }));
    const pool = getPool();
    const res = await pool.query(
      `update document_jobs set
         review_status = 'approved', reviewed_by = $3, reviewed_at = now(),
         fields = case when $4::jsonb is null then fields else fields || $4::jsonb end,
         step = 'act', status = 'pending', available_at = now(), attempt_count = 0, last_error = null, updated_at = now()
       where tenant_id = $1 and id = $2 and review_status = 'pending_review'
       returning id`,
      [ws.tenantId, id.data, currentUser(c).id, b.fields ? JSON.stringify(b.fields) : null],
    );
    if (res.rowCount === 0) throw new HttpError(409, "not_pending_review", "Ce document n'est plus en attente de vérification.");
    await audit(pool, {
      tenantId: ws.tenantId,
      actor: actorLabel(c),
      step: "review",
      decision: "approved",
      jobId: id.data,
      summary: { corrected_fields: b.fields ? Object.keys(b.fields) : [] },
    });
    return c.json({ ok: true });
  });

  app.post("/:id/reject", async (c) => {
    const ws = currentWorkspace(c);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw notFound("document_not_found");
    const b = await body(c.req, z.object({ reason: z.string().max(500).optional() }));
    const pool = getPool();
    const res = await pool.query(
      `update document_jobs set review_status = 'rejected', reviewed_by = $3, reviewed_at = now(),
         status = 'failed', closed_at = now(), last_error = coalesce($4, 'rejected_by_reviewer'), updated_at = now()
       where tenant_id = $1 and id = $2 and review_status = 'pending_review' returning id`,
      [ws.tenantId, id.data, currentUser(c).id, b.reason ?? null],
    );
    if (res.rowCount === 0) throw new HttpError(409, "not_pending_review", "Ce document n'est plus en attente de vérification.");
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "review", decision: "rejected", jobId: id.data });
    return c.json({ ok: true });
  });

  app.post("/:id/retry", async (c) => {
    const ws = currentWorkspace(c);
    assertActive(c);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw notFound("document_not_found");
    const res = await getPool().query(
      `update document_jobs set status = 'pending', step = 'ingest', attempt_count = 0, available_at = now(),
         last_error = null, review_status = null, closed_at = null, updated_at = now()
       where tenant_id = $1 and id = $2 and status = 'failed' and coalesce(review_status, '') <> 'rejected' returning id`,
      [ws.tenantId, id.data],
    );
    if (res.rowCount === 0) throw new HttpError(409, "not_retryable");
    return c.json({ ok: true });
  });

  // D2A settings (review threshold, auto-approval, accepted types) -------------
  app.get("/settings/config", async (c) => {
    const ws = currentWorkspace(c);
    return c.json({ config: await currentDocDraft(ws.tenantId) });
  });

  app.put("/settings/config", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(
      c.req,
      z.object({
        min_confidence: z.number().min(0.5).max(0.99),
        require_review: z.boolean(),
        max_auto_draft_eur: z.number().min(0).max(1_000_000),
        accepted_types: z.array(z.enum(["invoice", "quote", "delivery_note"])).min(1),
        target_provider: z.enum(["pennylane", "sellsy"]),
      }),
    );
    const cur = await currentDocDraft(ws.tenantId);
    const rules = cur.validation.rules.map((r) => {
      if (r.kind === "confidence_min") return { ...r, params: { ...r.params, min: b.min_confidence } };
      if (r.kind === "approval_threshold") return { ...r, params: { ...r.params, max_auto_draft_eur: b.max_auto_draft_eur } };
      return r;
    });
    const fieldsByType = { ...buildDocumentTemplate().documents.fields_by_type, ...cur.documents.fields_by_type };
    if (b.accepted_types.includes("delivery_note") && !fieldsByType.delivery_note) {
      fieldsByType.delivery_note = ["vendor_name", "delivery_number", "delivery_date", "site_reference"];
    }
    const next: DocumentToActionConfig = parseDocumentToActionConfig({
      ...cur,
      documents: { accepted_types: b.accepted_types, fields_by_type: fieldsByType },
      validation: { rules },
      action: {
        ...cur.action,
        require_review: b.require_review,
        target: { provider: b.target_provider, secret_ref: `targets.${b.target_provider}` },
      },
      alerts: { human_review: { ...cur.alerts.human_review, min_confidence: b.min_confidence } },
    });
    const pool = getPool();
    await saveDraftConfig(pool, { tenantId: ws.tenantId, product: "document_to_action", config: next, updatedBy: actorLabel(c) });
    const version = await publishConfig(pool, {
      tenantId: ws.tenantId,
      product: "document_to_action",
      config: next,
      publishedBy: actorLabel(c),
    });
    return c.json({ ok: true, version, config: next });
  });

  return app;
}
