import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsStorage, fileStorageKey, getStorage, setStorage } from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { afterAll, describe, expect, it } from "vitest";
import { purgeDeletedTenants } from "./scheduler.js";

describe.skipIf(!process.env.DATABASE_URL)("purge of deleted tenants", () => {
  afterAll(() => setStorage(null));

  it("deletes Portail objects from storage, not just the rows", async () => {
    setStorage(new FsStorage(mkdtempSync(join(tmpdir(), "purge-"))));
    const pool = getPool();
    const tenant = `purge-${randomBytes(4).toString("hex")}`;
    const dossier = randomUUID();
    const item = randomUUID();
    const file = randomUUID();
    const key = fileStorageKey(tenant, dossier, file);
    await pool.query(`insert into tenants (tenant_id, display_name, status, deleted_at) values ($1, 'Purge', 'active', now() - interval '1 minute')`, [tenant]);
    await pool.query(`insert into portal_dossiers (id, tenant_id, reference, title) values ($1, $2, 'D-1', 'Bilan')`, [dossier, tenant]);
    await pool.query(`insert into portal_items (id, dossier_id, tenant_id, label) values ($1, $2, $3, 'Relevé')`, [item, dossier, tenant]);
    await pool.query(
      `insert into portal_files (id, item_id, dossier_id, tenant_id, filename, mime_type, size_bytes, sha256, storage_key, wrapped_key)
       values ($1, $2, $3, $4, 'r.pdf', 'application/pdf', 3, 'x', $5, '\\x00')`,
      [file, item, dossier, tenant, key],
    );
    await getStorage().put(key, Buffer.from("enc"));

    await purgeDeletedTenants();

    await expect(getStorage().get(key)).rejects.toThrow();
    expect((await pool.query(`select 1 from tenants where tenant_id = $1`, [tenant])).rowCount).toBe(0);
  });
});
