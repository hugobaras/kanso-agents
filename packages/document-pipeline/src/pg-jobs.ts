import type { Pool } from "pg";
import { sha256 } from "./pipeline.js";
import { writeJobPayload } from "./storage.js";

export type DocumentJobRow = {
  id: string;
  tenant_id: string;
  config_version: number;
  source_type: string;
  source_item_id: string | null;
  storage_ref: string | null;
  content_sha256: string | null;
  document_type: string | null;
  step: string;
  status: string;
  fields: Record<string, unknown>;
  field_confidence: Record<string, unknown>;
  validation_results: unknown;
  remote_id: string | null;
  attempt_count: number;
  last_error: string | null;
};

export async function enqueueUploadJob(
  pool: Pool,
  opts: {
    tenantId: string;
    configVersion: number;
    content: Buffer;
    filename?: string;
  },
): Promise<{ jobId: string; contentSha256: string; storageRef: string }> {
  const contentSha256 = sha256(opts.content);
  const insert = await pool.query<{ id: string }>(
    `insert into document_jobs
       (tenant_id, config_version, source_type, source_item_id, step, status, content_sha256)
     values ($1, $2, 'upload_web', $3, 'ingest', 'pending', $4)
     returning id`,
    [
      opts.tenantId,
      opts.configVersion,
      opts.filename ?? null,
      contentSha256,
    ],
  );
  const jobId = insert.rows[0]!.id;
  const storageRef = writeJobPayload(opts.tenantId, jobId, opts.content);
  await pool.query(
    `update document_jobs set storage_ref = $2, updated_at = now() where id = $1::uuid`,
    [jobId, storageRef],
  );
  await pool.query(
    `insert into audit_events
       (tenant_id, job_id, at, step, decision, summary, actor, correlation_id)
     values ($1, $2::uuid, now(), 'ingest', 'accepted', $3::jsonb, 'api', $2)`,
    [
      opts.tenantId,
      jobId,
      JSON.stringify({ source_type: "upload_web", sha256: contentSha256 }),
    ],
  );
  return { jobId, contentSha256, storageRef };
}

/** Claim next pending job (FOR UPDATE SKIP LOCKED). */
export async function claimNextJob(
  pool: Pool,
): Promise<DocumentJobRow | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const sel = await client.query<DocumentJobRow>(
      `select id, tenant_id, config_version, source_type, source_item_id, storage_ref,
              content_sha256, document_type, step, status, fields, field_confidence,
              validation_results, remote_id, attempt_count, last_error
       from document_jobs
       where status = 'pending' and available_at <= now()
       order by available_at
       for update skip locked
       limit 1`,
    );
    const row = sel.rows[0];
    if (!row) {
      await client.query("commit");
      return null;
    }
    await client.query(
      `update document_jobs
       set status = 'running', attempt_count = attempt_count + 1, updated_at = now()
       where id = $1::uuid`,
      [row.id],
    );
    await client.query("commit");
    return { ...row, status: "running", attempt_count: row.attempt_count + 1 };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function completeJob(
  pool: Pool,
  opts: {
    jobId: string;
    tenantId: string;
    step: string;
    status: "succeeded" | "failed" | "waiting_human";
    documentType?: string;
    fields?: Record<string, unknown>;
    fieldConfidence?: Record<string, number>;
    validationResults?: unknown;
    remoteId?: string;
    lastError?: string;
  },
): Promise<void> {
  await pool.query(
    `update document_jobs set
       step = $2,
       status = $3,
       document_type = coalesce($4, document_type),
       fields = coalesce($5::jsonb, fields),
       field_confidence = coalesce($6::jsonb, field_confidence),
       validation_results = coalesce($7::jsonb, validation_results),
       remote_id = coalesce($8, remote_id),
       last_error = $9,
       updated_at = now(),
       closed_at = case when $3 in ('succeeded','failed') then now() else closed_at end
     where id = $1::uuid`,
    [
      opts.jobId,
      opts.step,
      opts.status,
      opts.documentType ?? null,
      opts.fields ? JSON.stringify(opts.fields) : null,
      opts.fieldConfidence ? JSON.stringify(opts.fieldConfidence) : null,
      opts.validationResults
        ? JSON.stringify(opts.validationResults)
        : null,
      opts.remoteId ?? null,
      opts.lastError ?? null,
    ],
  );
  await pool.query(
    `insert into audit_events
       (tenant_id, job_id, at, step, decision, summary, actor, correlation_id)
     values ($1, $2::uuid, now(), $3, $4, $5::jsonb, 'worker', $2)`,
    [
      opts.tenantId,
      opts.jobId,
      opts.step,
      opts.status,
      JSON.stringify({
        remote_id: opts.remoteId ?? null,
        last_error: opts.lastError ?? null,
      }),
    ],
  );
}

export async function requeueJob(
  pool: Pool,
  jobId: string,
  delayMs: number,
  lastError: string,
): Promise<void> {
  await pool.query(
    `update document_jobs set
       status = 'pending',
       available_at = now() + ($2 || ' milliseconds')::interval,
       last_error = $3,
       updated_at = now()
     where id = $1::uuid`,
    [jobId, String(delayMs), lastError.slice(0, 500)],
  );
}
