import { consumeQuota, getEntitlements } from "@kanso/billing";
import { extractDocumentText } from "@kanso/document-pipeline";
import { MistralOcrClient, type OcrClient } from "@kanso/llm";
import { AI_TERMS_VERSION, decryptFile, encryptPageTexts, fileAad, getStorage, tenantKek } from "@kanso/portal";
import { getPool } from "@kanso/tenancy";

/**
 * Extraction du texte des pièces Portail pour l'analyse IA (opt-in) : déchiffrement
 * en mémoire, extraction page par page, stockage chiffré. Rien n'est écrit en clair
 * ni journalisé (seulement des identifiants et des codes d'erreur).
 */

/** Mistral (OCR des scans) seulement si explicitement demandé : sinon simulation, sans appel externe. */
export function portailAiMode(env: NodeJS.ProcessEnv = process.env): "mistral" | "simulated" {
  return env.KANSO_PORTAIL_AI_MODE === "mistral" && !!env.MISTRAL_API_KEY ? "mistral" : "simulated";
}

function ocrClient(): OcrClient | undefined {
  return portailAiMode() === "mistral" ? new MistralOcrClient(process.env.MISTRAL_API_KEY!) : undefined;
}

type Pending = { id: string; tenant_id: string; dossier_id: string; storage_key: string; wrapped_key: Buffer; mime_type: string };

export async function portailAiExtract(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const key = process.env.KANSO_MASTER_KEY;
  if (!key) return { skipped: "no_master_key" };
  // One extractor at a time across workers: quota is consumed once per file.
  // Session-level lock, so it must stay on one dedicated connection.
  const lockConn = await pool.connect();
  const lock = await lockConn.query<{ ok: boolean }>(`select pg_try_advisory_lock(hashtext('portail_ai_extract')) as ok`);
  if (!lock.rows[0]?.ok) {
    lockConn.release();
    return { skipped: "locked" };
  }
  try {
    const pending = await pool.query<Pending>(
      `select f.id, f.tenant_id, f.dossier_id, f.storage_key, f.wrapped_key, f.mime_type
       from portal_files f
       join portal_items i on i.id = f.item_id
       join portal_dossiers d on d.id = f.dossier_id
       join portal_settings s on s.tenant_id = f.tenant_id
       join tenants t on t.tenant_id = f.tenant_id
       left join portal_file_texts x on x.file_id = f.id
       where f.deleted_at is null and f.scan_status = 'clean'
         and s.ai_enabled and s.ai_terms_version = $1 and not d.ai_excluded and not i.ai_excluded
         and t.deleted_at is null and t.status <> 'suspended'
         -- Files refused for quota are retried the next month.
         and (x.file_id is null or (x.status = 'quota' and x.created_at < date_trunc('month', now())))
       order by f.created_at
       limit 10`,
      [AI_TERMS_VERSION],
    );
    const ocr = ocrClient();
    const out = { done: 0, failed: 0, quota: 0, inactive: 0 };
    for (const f of pending.rows) {
      const ent = await getEntitlements(pool, f.tenant_id);
      if (!ent.active || ent.quotas.ai_pages <= 0) {
        out.inactive++;
        continue;
      }
      const save = (status: "done" | "failed" | "quota", extra: { method?: string; pages?: number; blob?: Buffer; wrapped?: Buffer; error?: string } = {}) =>
        pool.query(
          `insert into portal_file_texts (file_id, tenant_id, dossier_id, status, method, pages, blob, wrapped_key, error)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (file_id) do update set status = excluded.status, method = excluded.method, pages = excluded.pages,
             blob = excluded.blob, wrapped_key = excluded.wrapped_key, error = excluded.error, created_at = now()`,
          [f.id, f.tenant_id, f.dossier_id, status, extra.method ?? null, extra.pages ?? 0, extra.blob ?? null, extra.wrapped ?? null, extra.error ?? null],
        );
      try {
        const kek = tenantKek(key, f.tenant_id);
        const plain = decryptFile(kek, await getStorage().get(f.storage_key), f.wrapped_key, fileAad(f.tenant_id, f.dossier_id, f.id));
        const ex = await extractDocumentText(plain, f.mime_type, { ocr });
        const pages = Math.max(1, ex.pages);
        const q = await consumeQuota(pool, f.tenant_id, "ai_pages", ent.quotas.ai_pages, new Date(), pages);
        if (!q.ok) {
          await save("quota", { pages });
          out.quota++;
          continue;
        }
        const texts = ex.pageTexts ?? (ex.text ? [ex.text] : []);
        const { blob, wrappedKey } = encryptPageTexts(kek, f.tenant_id, f.dossier_id, f.id, texts);
        await save("done", { method: ex.method, pages, blob, wrapped: wrappedKey });
        out.done++;
      } catch (err) {
        const code = (err as { code?: string }).code ?? "extract_failed";
        console.warn(JSON.stringify({ level: "warn", event: "portail_ai_extract_failed", tenant: f.tenant_id, file: f.id, code }));
        await save("failed", { error: code });
        out.failed++;
      }
    }
    return out;
  } finally {
    await lockConn.query(`select pg_advisory_unlock(hashtext('portail_ai_extract'))`).catch(() => undefined);
    lockConn.release();
  }
}
