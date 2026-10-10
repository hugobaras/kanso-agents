import type { Pool } from "pg";
import { KansoError } from "@kanso/shared";
import type { AuthContext } from "./index.js";
import { decryptJson, encryptJson } from "./crypto.js";

export class PostgresSecretStore {
  constructor(
    private readonly pool: Pool,
    private readonly masterKey: string,
  ) {}

  async put(
    tenantId: string,
    secretRef: string,
    credentials: Record<string, string>,
  ): Promise<void> {
    const ciphertext = encryptJson(this.masterKey, credentials);
    await this.pool.query(
      `insert into tenant_secrets (tenant_id, secret_ref, ciphertext, updated_at)
       values ($1, $2, $3, now())
       on conflict (tenant_id, secret_ref)
       do update set ciphertext = excluded.ciphertext, updated_at = now()`,
      [tenantId, secretRef, ciphertext],
    );
  }

  async resolve(
    tenantId: string,
    provider: string,
    secretRef: string,
  ): Promise<AuthContext> {
    const res = await this.pool.query<{ ciphertext: Buffer }>(
      `select ciphertext from tenant_secrets
       where tenant_id = $1 and secret_ref = $2`,
      [tenantId, secretRef],
    );
    const row = res.rows[0];
    if (!row) {
      throw new KansoError(`Secret not found: ${secretRef}`, "secret_not_found");
    }
    const credentials = decryptJson<Record<string, string>>(
      this.masterKey,
      row.ciphertext,
    );
    return { provider, tenantId, credentials };
  }
}
