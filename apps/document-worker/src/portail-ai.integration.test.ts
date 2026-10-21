import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInvoicePdf } from "@kanso/document-pipeline";
import {
  AI_TERMS_VERSION,
  FsStorage,
  decryptPageTexts,
  encryptFile,
  fileAad,
  fileStorageKey,
  getStorage,
  setStorage,
  tenantKek,
} from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { portailAiExtract } from "./portail-ai-jobs.js";

const MASTER = "test-master-key-at-least-32-characters!!";
process.env.KANSO_MASTER_KEY ??= MASTER;

describe.skipIf(!process.env.DATABASE_URL)("Portail IA — extraction", () => {
  const pool = () => getPool();
  const tenant = `ia-${randomBytes(4).toString("hex")}`;
  const dossier = randomUUID();
  const item = randomUUID();
  const excludedItem = randomUUID();

  async function addFile(itemId: string, pdf: Buffer): Promise<string> {
    const id = randomUUID();
    const key = fileStorageKey(tenant, dossier, id);
    const { blob, wrappedKey } = encryptFile(tenantKek(process.env.KANSO_MASTER_KEY!, tenant), pdf, fileAad(tenant, dossier, id));
    await getStorage().put(key, blob);
    await pool().query(
      `insert into portal_files (id, item_id, dossier_id, tenant_id, filename, mime_type, size_bytes, sha256, storage_key, wrapped_key)
       values ($1, $2, $3, $4, 'f.pdf', 'application/pdf', $5, 'x', $6, $7)`,
      [id, itemId, dossier, tenant, pdf.length, key, wrappedKey],
    );
    return id;
  }
  const textRow = async (id: string) =>
    (await pool().query(`select status, pages, blob, wrapped_key from portal_file_texts where file_id = $1`, [id])).rows[0];

  beforeAll(async () => {
    setStorage(new FsStorage(mkdtempSync(join(tmpdir(), "ia-"))));
    await pool().query(`insert into tenants (tenant_id, display_name, status) values ($1, 'IA', 'active')`, [tenant]);
    await pool().query(`insert into subscriptions (tenant_id, plan, status) values ($1, 'portail_cabinet', 'active')`, [tenant]);
    await pool().query(`insert into portal_settings (tenant_id, ai_enabled, ai_terms_version) values ($1, true, $2)`, [tenant, AI_TERMS_VERSION]);
    await pool().query(`insert into portal_dossiers (id, tenant_id, reference, title) values ($1, $2, 'D-1', 'Bilan')`, [dossier, tenant]);
    await pool().query(
      `insert into portal_items (id, dossier_id, tenant_id, label, ai_excluded) values ($1, $3, $4, 'Facture', false), ($2, $3, $4, 'Certificat médical', true)`,
      [item, excludedItem, dossier, tenant],
    );
  });

  afterAll(async () => {
    await pool().query(`delete from usage_counters where tenant_id = $1`, [tenant]);
    await pool().query(`delete from tenants where tenant_id = $1`, [tenant]);
    setStorage(null);
  });

  it("extracts page texts encrypted, counts pages, skips excluded items", async () => {
    const ok = await addFile(item, buildInvoicePdf({ vendor: "Cabinet Test SARL" }));
    const skipped = await addFile(excludedItem, buildInvoicePdf());
    await portailAiExtract();
    const row = await textRow(ok);
    expect(row.status).toBe("done");
    expect(row.pages).toBe(1);
    expect(row.blob.toString("latin1")).not.toContain("Cabinet Test");
    const pages = decryptPageTexts(tenantKek(process.env.KANSO_MASTER_KEY!, tenant), tenant, dossier, ok, row.blob, row.wrapped_key);
    expect(pages[0]).toContain("Cabinet Test SARL");
    expect(await textRow(skipped)).toBeUndefined();
    const used = await pool().query(`select count from usage_counters where tenant_id = $1 and metric = 'ai_pages'`, [tenant]);
    expect(used.rows[0].count).toBe(1);
  });

  it("refuses beyond the monthly quota, and stops when the feature is off", async () => {
    await pool().query(`update usage_counters set count = 300 where tenant_id = $1 and metric = 'ai_pages'`, [tenant]);
    const over = await addFile(item, buildInvoicePdf());
    await portailAiExtract();
    expect((await textRow(over)).status).toBe("quota");

    await pool().query(`update portal_settings set ai_enabled = false where tenant_id = $1`, [tenant]);
    const off = await addFile(item, buildInvoicePdf());
    await portailAiExtract();
    expect(await textRow(off)).toBeUndefined();
  });
});
