export {
  sha256,
  ingestDocument,
  extractDocument,
  validateDocument,
  createDraftAction,
  runDocumentPipeline,
  finalModeAllowed,
  type DocumentJob,
  type DocumentJobStep,
} from "./pipeline.js";
export {
  enqueueUploadJob,
  claimNextJob,
  completeJob,
  requeueJob,
  type DocumentJobRow,
} from "./pg-jobs.js";
export { storageRoot, writeJobPayload, readJobPayload } from "./storage.js";

import type { DocumentToActionConfig } from "@kanso/config";
import type { AccountingTargetAdapter, AlertAdapter } from "@kanso/adapters";
import type { AuthContext } from "@kanso/tenancy";
import type { LlmClient } from "@kanso/llm";
import { runDocumentPipeline, type DocumentJob } from "./pipeline.js";

/** @deprecated alias — préférer runDocumentPipeline */
export async function runDocumentHappyPath(opts: {
  tenantId: string;
  config: DocumentToActionConfig;
  fileContent: Buffer;
  llm: LlmClient;
  target: AccountingTargetAdapter;
  targetAuth: AuthContext;
  alerts: AlertAdapter;
  alertAuth: AuthContext;
  knownIbans: string[];
  existingKeys?: Set<string>;
}): Promise<DocumentJob> {
  return runDocumentPipeline(opts);
}
