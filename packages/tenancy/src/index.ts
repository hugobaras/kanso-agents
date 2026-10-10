import { KansoError } from "@kanso/shared";

export type AuthContext = {
  provider: string;
  tenantId: string;
  /** Opaque credentials — never log. */
  credentials: Record<string, string>;
};

/** In-memory secret store for local/e2e. Prod: Postgres encrypted column. */
export class InMemorySecretStore {
  private readonly secrets = new Map<string, Record<string, string>>();

  put(tenantId: string, secretRef: string, credentials: Record<string, string>) {
    this.secrets.set(`${tenantId}:${secretRef}`, credentials);
  }

  resolve(tenantId: string, provider: string, secretRef: string): AuthContext {
    const credentials = this.secrets.get(`${tenantId}:${secretRef}`);
    if (!credentials) {
      throw new KansoError(
        `Secret not found: ${secretRef}`,
        "secret_not_found",
      );
    }
    return { provider, tenantId, credentials };
  }
}

export function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId || !/^[a-z0-9-]+$/.test(tenantId)) {
    throw new KansoError("Invalid tenant_id", "invalid_tenant");
  }
  return tenantId;
}

export { encryptJson, decryptJson } from "./crypto.js";
export { PostgresSecretStore } from "./pg-secrets.js";
export { getPool, withTenantLocal } from "./pg-pool.js";
export {
  recordUsage,
  sumUsageEurToday,
  softCapAlreadyAlertedToday,
  recordSoftCapBreach,
  softCapEurPerDay,
  type UsageRecordInput,
} from "./usage.js";
export {
  RETENTION_DAYS,
  runRetentionPurge,
  type RetentionPurgeResult,
  type PurgeBucketCounts,
} from "./retention.js";
