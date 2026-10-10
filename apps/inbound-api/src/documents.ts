import { parseDocumentToActionConfig } from "@kanso/config";
import { enqueueUploadJob } from "@kanso/document-pipeline";
import { getPool, requireTenantId } from "@kanso/tenancy";
import type { Hono } from "hono";

async function loadPublishedDocumentConfig(tenantId: string) {
  const pool = getPool();
  const res = await pool.query<{ config: unknown; version: number }>(
    `select config, version from tenant_configs
     where tenant_id = $1 and product = 'document_to_action' and status = 'published'
     order by version desc limit 1`,
    [tenantId],
  );
  return res.rows[0] ?? null;
}

export function mountDocumentRoutes(app: Hono) {
  app.post("/v1/:tenantId/documents", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const published = await loadPublishedDocumentConfig(tenantId);
    if (!published) {
      return c.json({ error: "no_published_document_config" }, 404);
    }
    parseDocumentToActionConfig(published.config);

    const body = (await c.req.json().catch(() => ({}))) as {
      content_base64?: string;
      filename?: string;
    };
    if (!body.content_base64) {
      return c.json({ error: "content_base64_required" }, 400);
    }
    let content: Buffer;
    try {
      content = Buffer.from(body.content_base64, "base64");
    } catch {
      return c.json({ error: "invalid_base64" }, 400);
    }
    if (content.length === 0) {
      return c.json({ error: "empty_content" }, 400);
    }
    if (content.length > 15 * 1024 * 1024) {
      return c.json({ error: "file_too_large" }, 413);
    }

    const pool = getPool();
    const enqueued = await enqueueUploadJob(pool, {
      tenantId,
      configVersion: published.version,
      content,
      filename: body.filename,
    });

    return c.json(
      {
        job_id: enqueued.jobId,
        status: "pending",
        step: "ingest",
        content_sha256: enqueued.contentSha256,
      },
      202,
    );
  });

  app.get("/v1/:tenantId/documents/:jobId", async (c) => {
    const tenantId = requireTenantId(c.req.param("tenantId"));
    const jobId = c.req.param("jobId");
    const pool = getPool();
    const res = await pool.query(
      `select id, status, step, document_type, remote_id, last_error, fields,
              created_at, updated_at, closed_at
       from document_jobs
       where tenant_id = $1 and id = $2::uuid`,
      [tenantId, jobId],
    );
    const row = res.rows[0];
    if (!row) return c.json({ error: "job_not_found" }, 404);
    return c.json({
      job_id: row.id,
      status: row.status,
      step: row.step,
      document_type: row.document_type,
      remote_id: row.remote_id,
      last_error: row.last_error,
      fields: row.fields,
      created_at: row.created_at,
      updated_at: row.updated_at,
      closed_at: row.closed_at,
    });
  });
}
