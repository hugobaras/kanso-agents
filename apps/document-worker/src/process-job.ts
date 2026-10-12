import { getAccountingAdapter } from "@kanso/adapters";
import { parseDocumentToActionConfig, type DocumentToActionConfig } from "@kanso/config";
import {
  completeJob,
  createDraftAction,
  duplicateKey,
  extractDocument,
  extractDocumentText,
  heuristicExtract,
  ingestDocument,
  readJobPayload,
  requeueJob,
  sniffMime,
  validateDocument,
  type DocumentJob,
  type DocumentJobRow,
} from "@kanso/document-pipeline";
import {
  createLlmClient,
  estimateUsageEur,
  MeteringLlmClient,
  MistralOcrClient,
  MockLlmClient,
  RetryLlmClient,
  type LlmClient,
  type LlmUsage,
} from "@kanso/llm";
import { templates } from "@kanso/mailer";
import { getPool, PostgresSecretStore, recordUsage, type AuthContext } from "@kanso/tenancy";
import { appLink, notifyAdmins } from "./notify.js";

async function loadDocumentConfig(tenantId: string, version: number) {
  const res = await getPool().query<{ config: unknown }>(
    `select config from tenant_configs
     where tenant_id = $1 and product = 'document_to_action' and version = $2`,
    [tenantId, version],
  );
  const row = res.rows[0];
  return row ? parseDocumentToActionConfig(row.config) : null;
}

function secrets(): PostgresSecretStore | null {
  const key = process.env.KANSO_MASTER_KEY;
  return key ? new PostgresSecretStore(getPool(), key) : null;
}

async function resolveTarget(tenantId: string, config: DocumentToActionConfig): Promise<AuthContext | null> {
  const provider = config.action.target.provider;
  const store = secrets();
  try {
    if (store) return await store.resolve(tenantId, provider, config.action.target.secret_ref);
  } catch {
    // not connected
  }
  // Sandbox (default for new workspaces): mock adapter, no remote write.
  if (config.action.sandbox !== false) return { provider, tenantId, credentials: { sandbox: "true" } };
  return null;
}

async function knownIbans(tenantId: string, config: DocumentToActionConfig): Promise<string[]> {
  const rule = config.validation.rules.find((r) => r.kind === "iban_allowlist");
  if (!rule) return [];
  const ref = typeof rule.params?.secret_ref === "string" ? rule.params.secret_ref : "validation.known_ibans";
  const store = secrets();
  try {
    if (store) {
      const auth = await store.resolve(tenantId, "validation", ref);
      return (auth.credentials.ibans ?? "").split(/[,;\s]+/).filter(Boolean);
    }
  } catch {
    // none configured
  }
  return config.action.sandbox !== false
    ? (process.env.KANSO_KNOWN_IBANS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    : [];
}

async function existingKeys(tenantId: string, jobId: string, config: DocumentToActionConfig): Promise<Set<string>> {
  const rule = config.validation.rules.find((r) => r.kind === "duplicate_check");
  if (!rule) return new Set();
  const keys = Array.isArray(rule.params?.keys) ? (rule.params!.keys as string[]) : ["vendor_name", "invoice_number"];
  const res = await getPool().query<{ fields: Record<string, unknown> }>(
    `select fields from document_jobs
     where tenant_id = $1 and id <> $2 and fields <> '{}'::jsonb
       and coalesce(review_status, '') <> 'rejected' and status <> 'failed'
     order by created_at desc limit 5000`,
    [tenantId, jobId],
  );
  const out = new Set<string>();
  for (const r of res.rows) {
    const k = duplicateKey(r.fields, keys);
    if (k) out.add(k);
  }
  return out;
}

function extractionLlm(): { llm: LlmClient | null; ocr: MistralOcrClient | null } {
  const key = process.env.MISTRAL_API_KEY;
  if (!key || process.env.KANSO_D2A_FORCE_MOCK === "1") return { llm: null, ocr: null };
  return {
    llm: new RetryLlmClient(createLlmClient({ model: process.env.KANSO_MISTRAL_EXTRACT_MODEL ?? "mistral-small-latest" }), {
      maxAttempts: 2,
      baseDelayMs: 800,
    }),
    ocr: new MistralOcrClient(key),
  };
}

async function recordDocUsage(tenantId: string, jobId: string, usages: LlmUsage[]) {
  for (const u of usages) {
    await recordUsage(getPool(), {
      tenantId,
      product: "document_to_action",
      provider: u.provider,
      modelId: u.modelId,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      estimatedEur: estimateUsageEur(u),
      correlationId: jobId,
    });
  }
}

const REASON_LABEL: Record<string, string> = {
  low_confidence: "Lecture incertaine de champs clés",
  missing_fields: "Champs essentiels introuvables",
  totals_incoherent: "Totaux incohérents (HT + TVA ≠ TTC)",
  iban_unknown: "IBAN inconnu",
  duplicate: "Doublon probable",
  unsupported_document_type: "Type de document non accepté",
  amount_above_threshold: "Montant au-dessus du seuil",
  empty_text: "Aucun texte lisible",
};

async function filenameOf(jobId: string): Promise<string> {
  const r = await getPool().query<{ original_filename: string | null }>(`select original_filename from document_jobs where id = $1`, [jobId]);
  return r.rows[0]?.original_filename ?? "document";
}

/** Approved by a human → push the draft to the accounting target. */
async function actOnApproved(row: DocumentJobRow, config: DocumentToActionConfig): Promise<void> {
  const pool = getPool();
  const targetAuth = await resolveTarget(row.tenant_id, config);
  if (!targetAuth) {
    await completeJob(pool, {
      jobId: row.id,
      tenantId: row.tenant_id,
      step: "act",
      status: "failed",
      lastError: `Connectez ${config.action.target.provider} dans Intégrations pour envoyer les brouillons.`,
    });
    return;
  }
  const job: DocumentJob = {
    id: row.id,
    tenantId: row.tenant_id,
    step: "validate",
    contentSha256: row.content_sha256 ?? "",
    documentType: (row.document_type as DocumentJob["documentType"]) ?? "invoice",
    fields: row.fields,
    fieldConfidence: row.field_confidence as Record<string, number>,
  };
  const target = getAccountingAdapter(config.action.target.provider, targetAuth);
  const done = await createDraftAction(job, config, target, targetAuth);
  await completeJob(pool, {
    jobId: row.id,
    tenantId: row.tenant_id,
    step: done.step,
    status: done.step === "done" ? "succeeded" : "failed",
    remoteId: done.remoteId,
    lastError: done.step === "done" ? undefined : done.anomalyReason,
  });
}

export async function processClaimedJob(row: DocumentJobRow): Promise<void> {
  const pool = getPool();
  const config = row.storage_ref ? await loadDocumentConfig(row.tenant_id, row.config_version) : null;
  if (!row.storage_ref || !config) {
    await completeJob(pool, {
      jobId: row.id,
      tenantId: row.tenant_id,
      step: "anomaly",
      status: "failed",
      lastError: row.storage_ref ? "missing_config" : "missing_storage_ref",
    });
    return;
  }

  try {
    if (row.step === "act") {
      await actOnApproved(row, config);
      return;
    }

    const content = readJobPayload(row.storage_ref);
    const mime = sniffMime(content);
    const { llm, ocr } = extractionLlm();
    const usages: LlmUsage[] = [];

    let text = "";
    let pages: number | null = null;
    if (mime) {
      const extraction = await extractDocumentText(content, mime, { ocr: ocr ?? undefined });
      text = extraction.text;
      pages = extraction.pages;
      if (extraction.usage) usages.push(extraction.usage);
    } else {
      // Legacy pilot stubs (plain text payloads).
      text = content.toString("utf8").slice(0, 20_000);
    }
    await pool.query(`update document_jobs set extracted_text = $2, page_count = $3, updated_at = now() where id = $1`, [
      row.id,
      text.slice(0, 100_000),
      pages,
    ]);

    let job = ingestDocument({ jobId: row.id, tenantId: row.tenant_id, fileContent: content });
    if (!text.trim()) {
      job = { ...job, step: "anomaly", anomalyReason: "empty_text", validationResults: { status: "anomaly", reason: "empty_text", message: "Aucun texte lisible : document scanné sans OCR disponible ?" } };
    } else {
      const metering = new MeteringLlmClient(llm ?? new MockLlmClient([heuristicExtract(text)]));
      job = await extractDocument(job, metering, { text, config });
      usages.push(...metering.usages);
      job = await validateDocument(job, config, {
        knownIbans: await knownIbans(row.tenant_id, config),
        existingKeys: await existingKeys(row.tenant_id, row.id, config),
      });
    }
    await recordDocUsage(row.tenant_id, row.id, usages);

    const docPath = `/app/${row.tenant_id}/documents/${row.id}`;
    if (job.step === "anomaly") {
      await completeJob(pool, {
        jobId: row.id,
        tenantId: row.tenant_id,
        step: "anomaly",
        status: "waiting_human",
        documentType: job.documentType,
        fields: job.fields,
        fieldConfidence: job.fieldConfidence,
        validationResults: { ...(job.validationResults ?? {}), reason: job.anomalyReason },
        lastError: job.anomalyReason,
      });
      await pool.query(`update document_jobs set review_status = 'pending_review' where id = $1`, [row.id]);
      const filename = await filenameOf(row.id);
      const reason = REASON_LABEL[job.anomalyReason ?? ""] ?? job.anomalyReason ?? "Anomalie";
      await notifyAdmins(row.tenant_id, {
        type: "document:anomaly",
        title: `Document à vérifier — ${filename}`,
        body: reason,
        link: docPath,
        email: (workspace) => templates.documentAnomaly({ workspace, filename, reason, url: appLink(docPath) }),
      });
      return;
    }

    const needsReview = config.action.require_review !== false || !!job.reviewReason;
    if (needsReview) {
      await completeJob(pool, {
        jobId: row.id,
        tenantId: row.tenant_id,
        step: "validate",
        status: "waiting_human",
        documentType: job.documentType,
        fields: job.fields,
        fieldConfidence: job.fieldConfidence,
        validationResults: { ...(job.validationResults ?? {}), reason: job.reviewReason ?? null },
      });
      await pool.query(`update document_jobs set review_status = 'pending_review' where id = $1`, [row.id]);
      await notifyAdmins(row.tenant_id, {
        type: "document:review",
        title: `Document prêt à valider — ${await filenameOf(row.id)}`,
        body: job.reviewReason ? REASON_LABEL[job.reviewReason] : undefined,
        link: docPath,
      });
      return;
    }

    await pool.query(
      `update document_jobs set review_status = 'auto_approved', step = 'validate', document_type = $2,
         fields = $3::jsonb, field_confidence = $4::jsonb, validation_results = $5::jsonb, updated_at = now()
       where id = $1`,
      [
        row.id,
        job.documentType ?? null,
        JSON.stringify(job.fields),
        JSON.stringify(job.fieldConfidence),
        JSON.stringify(job.validationResults ?? {}),
      ],
    );
    await actOnApproved(
      { ...row, step: "act", document_type: job.documentType ?? null, fields: job.fields, field_confidence: job.fieldConfidence },
      config,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = (err as { code?: string }).code === "too_many_pages";
    if (!permanent && row.attempt_count < 3) {
      await requeueJob(pool, row.id, 2000 * row.attempt_count, message);
      return;
    }
    await completeJob(pool, {
      jobId: row.id,
      tenantId: row.tenant_id,
      step: "anomaly",
      status: "failed",
      lastError: message.slice(0, 500),
    });
  }
}
