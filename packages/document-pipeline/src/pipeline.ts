import { createHash } from "node:crypto";
import type { DocumentToActionConfig } from "@kanso/config";
import type { AccountingTargetAdapter, AlertAdapter } from "@kanso/adapters";
import type { AuthContext } from "@kanso/tenancy";
import type { LlmClient } from "@kanso/llm";
import { ExtractLlmOutputSchema } from "@kanso/llm";
import { KansoError } from "@kanso/shared";

export type DocumentJobStep =
  | "ingest"
  | "extract"
  | "validate"
  | "act"
  | "anomaly"
  | "done";

export type DocumentJob = {
  id: string;
  tenantId: string;
  step: DocumentJobStep;
  contentSha256: string;
  documentType?: "invoice" | "quote" | "delivery_note";
  fields: Record<string, unknown>;
  fieldConfidence: Record<string, number>;
  remoteId?: string;
  anomalyReason?: string;
  validationResults?: Record<string, unknown>;
};

const CRITICAL_INVOICE = ["total_ttc", "invoice_number", "iban"];

export function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function ingestDocument(opts: {
  jobId: string;
  tenantId: string;
  fileContent: Buffer;
}): DocumentJob {
  return {
    id: opts.jobId,
    tenantId: opts.tenantId,
    step: "ingest",
    contentSha256: sha256(opts.fileContent),
    fields: {},
    fieldConfidence: {},
  };
}

export async function extractDocument(
  job: DocumentJob,
  llm: LlmClient,
): Promise<DocumentJob> {
  const next = { ...job, step: "extract" as const };
  const { data } = await llm.completeStructured({
    system: "extract",
    user: "document",
    schema: ExtractLlmOutputSchema,
  });
  return {
    ...next,
    documentType: data.document_type,
    fields: data.fields,
    fieldConfidence: data.field_confidence,
  };
}

export async function validateDocument(
  job: DocumentJob,
  config: DocumentToActionConfig,
  opts: {
    knownIbans: string[];
    existingKeys?: Set<string>;
    alerts: AlertAdapter;
    alertAuth: AuthContext;
  },
): Promise<DocumentJob> {
  const min = config.alerts.human_review.min_confidence;
  for (const field of CRITICAL_INVOICE) {
    if (!(field in job.fields)) continue;
    const conf = job.fieldConfidence[field] ?? 0;
    if (conf < min) {
      await opts.alerts.send(
        {
          channel: "slack",
          event: "low_confidence",
          title: "Low confidence",
          body: field,
          metadata: { field, conf },
        },
        opts.alertAuth,
        {
          tenantId: job.tenantId,
          correlationId: job.id,
          configVersion: 1,
          attempt: 1,
        },
      );
      return {
        ...job,
        step: "anomaly",
        anomalyReason: "low_confidence",
        validationResults: { field, conf, min },
      };
    }
  }

  const ht = Number(job.fields.total_ht);
  const vat = Number(job.fields.vat_amount);
  const ttc = Number(job.fields.total_ttc);
  if (Math.abs(ht + vat - ttc) > 0.05) {
    return {
      ...job,
      step: "anomaly",
      anomalyReason: "totals_incoherent",
      validationResults: { ht, vat, ttc },
    };
  }

  const iban = String(job.fields.iban ?? "");
  if (iban && !opts.knownIbans.includes(iban)) {
    return {
      ...job,
      step: "anomaly",
      anomalyReason: "iban_unknown",
      validationResults: { iban },
    };
  }

  const dupKey = `${job.fields.vendor_name}|${job.fields.invoice_number}`;
  if (opts.existingKeys?.has(dupKey)) {
    return {
      ...job,
      step: "anomaly",
      anomalyReason: "duplicate",
      validationResults: { dupKey },
    };
  }

  return {
    ...job,
    step: "validate",
    validationResults: { ok: true },
  };
}

export function finalModeAllowed(): boolean {
  return (
    process.env.KANSO_ALLOW_FINAL === "1" ||
    process.env.KANSO_ALLOW_FINAL === "true"
  );
}

export async function createDraftAction(
  job: DocumentJob,
  config: DocumentToActionConfig,
  target: AccountingTargetAdapter,
  targetAuth: AuthContext,
  opts: { allowFinal?: boolean } = {},
): Promise<DocumentJob> {
  const mode = config.action.mode;
  if (mode === "final" && !(opts.allowFinal ?? finalModeAllowed())) {
    throw new KansoError(
      "action.mode=final requires KANSO_ALLOW_FINAL=1 or CLI confirm-final-action",
      "final_not_confirmed",
    );
  }
  if (job.step === "anomaly") return job;

  const acting = { ...job, step: "act" as const };
  const result = await target.createDraft(
    {
      documentType: acting.documentType ?? "invoice",
      fields: acting.fields,
      idempotencyKey: acting.id,
      mode,
    },
    targetAuth,
    {
      tenantId: acting.tenantId,
      correlationId: acting.id,
      configVersion: 1,
      attempt: 1,
    },
  );
  if (result.status !== "ok") {
    return {
      ...acting,
      step: "anomaly",
      anomalyReason: result.errorCode,
    };
  }
  return {
    ...acting,
    remoteId: result.data.remoteId,
    step: "done",
  };
}

/** Pipeline complet extract → validate → draft|final (sandbox/mock). */
export async function runDocumentPipeline(opts: {
  tenantId: string;
  jobId?: string;
  config: DocumentToActionConfig;
  fileContent: Buffer;
  llm: LlmClient;
  target: AccountingTargetAdapter;
  targetAuth: AuthContext;
  alerts: AlertAdapter;
  alertAuth: AuthContext;
  knownIbans: string[];
  existingKeys?: Set<string>;
  allowFinal?: boolean;
}): Promise<DocumentJob> {
  let job = ingestDocument({
    jobId: opts.jobId ?? "job_e2e",
    tenantId: opts.tenantId,
    fileContent: opts.fileContent,
  });
  job = await extractDocument(job, opts.llm);
  job = await validateDocument(job, opts.config, {
    knownIbans: opts.knownIbans,
    existingKeys: opts.existingKeys,
    alerts: opts.alerts,
    alertAuth: opts.alertAuth,
  });
  if (job.step === "anomaly") return job;
  return createDraftAction(job, opts.config, opts.target, opts.targetAuth, {
    allowFinal: opts.allowFinal,
  });
}
