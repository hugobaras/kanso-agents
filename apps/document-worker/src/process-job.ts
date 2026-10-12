import {
  createPennylaneAdapter,
  MockAlertAdapter,
} from "@kanso/adapters";
import { parseDocumentToActionConfig } from "@kanso/config";
import {
  completeJob,
  readJobPayload,
  requeueJob,
  runDocumentPipeline,
  type DocumentJobRow,
} from "@kanso/document-pipeline";
import { createLlmClient, MockLlmClient } from "@kanso/llm";
import { getPool } from "@kanso/tenancy";

async function loadDocumentConfig(tenantId: string, version: number) {
  const pool = getPool();
  const res = await pool.query<{ config: unknown }>(
    `select config from tenant_configs
     where tenant_id = $1 and product = 'document_to_action' and version = $2`,
    [tenantId, version],
  );
  const row = res.rows[0];
  if (!row) return null;
  return parseDocumentToActionConfig(row.config);
}

function mockFixtureFromSha(sha: string) {
  const n = parseInt(sha.slice(0, 6), 16) % 50;
  const ht = 100 + n;
  const vat = Math.round(ht * 0.2 * 100) / 100;
  const ttc = Math.round((ht + vat) * 100) / 100;
  return {
    document_type: "invoice" as const,
    fields: {
      vendor_name: "Upload Vendor",
      invoice_number: `UP-${sha.slice(0, 8)}`,
      invoice_date: "2026-10-01",
      currency: "EUR",
      total_ht: ht,
      vat_amount: vat,
      total_ttc: ttc,
      iban: "FR7611111222223333444445555",
      due_date: "2026-10-31",
    },
    field_confidence: {
      vendor_name: 0.95,
      invoice_number: 0.99,
      total_ht: 0.95,
      vat_amount: 0.95,
      total_ttc: 0.97,
      iban: 0.9,
    },
  };
}

export async function processClaimedJob(row: DocumentJobRow): Promise<void> {
  const pool = getPool();
  if (!row.storage_ref) {
    await completeJob(pool, {
      jobId: row.id,
      tenantId: row.tenant_id,
      step: "anomaly",
      status: "failed",
      lastError: "missing_storage_ref",
    });
    return;
  }

  const config = await loadDocumentConfig(row.tenant_id, row.config_version);
  if (!config) {
    await completeJob(pool, {
      jobId: row.id,
      tenantId: row.tenant_id,
      step: "anomaly",
      status: "failed",
      lastError: "missing_config",
    });
    return;
  }

  try {
    const content = readJobPayload(row.storage_ref);
    const forceMock =
      process.env.KANSO_D2A_FORCE_MOCK === "1" ||
      content.length < 512 ||
      content.toString("utf8").includes("demo-facture") ||
      content.toString("utf8").includes("demo kanso");
    const llm =
      process.env.MISTRAL_API_KEY && !forceMock
        ? createLlmClient()
        : new MockLlmClient([
            mockFixtureFromSha(row.content_sha256 ?? content.toString("hex")),
          ]);
    const target = createPennylaneAdapter({
      provider: "pennylane",
      tenantId: row.tenant_id,
      credentials: { sandbox: "true" },
    });

    const job = await runDocumentPipeline({
      tenantId: row.tenant_id,
      jobId: row.id,
      config,
      fileContent: content,
      llm,
      target,
      targetAuth: {
        provider: "pennylane",
        tenantId: row.tenant_id,
        credentials: { sandbox: "true" },
      },
      alerts: new MockAlertAdapter(),
      alertAuth: {
        provider: "slack",
        tenantId: row.tenant_id,
        credentials: {},
      },
      knownIbans: (process.env.KANSO_KNOWN_IBANS ??
        "FR7611111222223333444445555")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });

    if (job.step === "anomaly") {
      await completeJob(pool, {
        jobId: row.id,
        tenantId: row.tenant_id,
        step: "anomaly",
        status: "waiting_human",
        documentType: job.documentType,
        fields: job.fields,
        fieldConfidence: job.fieldConfidence,
        validationResults: job.validationResults,
        lastError: job.anomalyReason,
      });
      return;
    }

    await completeJob(pool, {
      jobId: row.id,
      tenantId: row.tenant_id,
      step: job.step,
      status: "succeeded",
      documentType: job.documentType,
      fields: job.fields,
      fieldConfidence: job.fieldConfidence,
      validationResults: job.validationResults,
      remoteId: job.remoteId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (row.attempt_count < 3) {
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
