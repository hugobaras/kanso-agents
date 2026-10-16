import { computeStage, isComplete, type ItemStatus, type Stage } from "./stages.js";
import { getStorage } from "./storage.js";
import { hashToken, newLinkToken } from "./crypto.js";

/** Sous-ensemble de pg.Pool / PoolClient dont ce module a besoin. */
export type Db = {
  query<R = any>(sql: string, params?: unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
};

export const LINK_DAYS = 7;
export const CODE_MINUTES = 10;
export const SESSION_DAYS = 14;

export function clientBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.KANSO_PORTAIL_URL ?? env.KANSO_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

export function clientLink(token: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${clientBaseUrl(env)}/espace/${token}`;
}

export type Brand = { name: string; color?: string };

export async function loadBrand(db: Db, tenantId: string): Promise<Brand> {
  const res = await db.query<{ display_name: string; ps_name: string | null; brand_color: string | null }>(
    `select t.display_name, ps.display_name as ps_name, ps.brand_color
     from tenants t left join portal_settings ps on ps.tenant_id = t.tenant_id where t.tenant_id = $1`,
    [tenantId],
  );
  const r = res.rows[0];
  return { name: r?.ps_name?.trim() || r?.display_name || "Votre cabinet", color: r?.brand_color ?? undefined };
}

/** Émet un lien personnel pour un contact. `revokeOthers` : renvoi explicite → les anciens liens meurent. */
export async function issueLink(db: Db, contactId: string, opts: { revokeOthers?: boolean } = {}): Promise<{ token: string; url: string; expiresAt: Date }> {
  if (opts.revokeOthers) {
    await db.query(`update portal_links set revoked_at = now() where contact_id = $1 and revoked_at is null`, [contactId]);
  }
  const token = newLinkToken();
  const expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000);
  await db.query(`insert into portal_links (contact_id, token_hash, expires_at) values ($1, $2, $3)`, [contactId, hashToken(token), expiresAt]);
  return { token, url: clientLink(token), expiresAt };
}

export type ItemRow = { id: string; label: string; required: boolean; status: ItemStatus; files: number };

export async function loadItems(db: Db, dossierId: string): Promise<ItemRow[]> {
  const res = await db.query<ItemRow>(
    `select i.id, i.label, i.required, i.status,
            (select count(*)::int from portal_files f where f.item_id = i.id and f.deleted_at is null and f.scan_status = 'clean') as files
     from portal_items i where i.dossier_id = $1 order by i.position, i.label`,
    [dossierId],
  );
  return res.rows;
}

/**
 * Recalcule l'étape d'un dossier d'après ses pièces. Renvoie `becameComplete`
 * la première fois que toutes les pièces obligatoires sont fournies.
 */
export async function recomputeStage(db: Db, dossierId: string): Promise<{ stage: Stage; becameComplete: boolean }> {
  const d = await db.query<{ stage: Stage; completed_notified_at: Date | null }>(
    `select stage, completed_notified_at from portal_dossiers where id = $1`,
    [dossierId],
  );
  const row = d.rows[0];
  if (!row) return { stage: "a_completer", becameComplete: false };
  const items = (await loadItems(db, dossierId)).map((i) => ({ required: i.required, status: i.status, hasFile: i.files > 0 }));
  const stage = computeStage(row.stage, items);
  let becameComplete = false;
  if (isComplete(items) && !row.completed_notified_at && row.stage !== "termine") {
    becameComplete = true;
    await db.query(`update portal_dossiers set completed_notified_at = now() where id = $1`, [dossierId]);
  }
  if (!isComplete(items) && row.completed_notified_at) {
    // Une pièce refusée/supprimée rouvre le dossier : la prochaine complétion notifiera de nouveau.
    await db.query(`update portal_dossiers set completed_notified_at = null where id = $1`, [dossierId]);
  }
  if (stage !== row.stage) {
    await db.query(`update portal_dossiers set stage = $2, updated_at = now() where id = $1`, [dossierId, stage]);
  }
  return { stage, becameComplete };
}

/** Supprime fichiers (objets + lignes) puis le dossier. Irréversible. */
export async function purgeDossier(db: Db, dossierId: string): Promise<number> {
  const files = await db.query<{ storage_key: string }>(`select storage_key from portal_files where dossier_id = $1`, [dossierId]);
  const storage = getStorage();
  let n = 0;
  let failed = 0;
  for (const f of files.rows) {
    try {
      await storage.delete(f.storage_key);
      n++;
    } catch (err) {
      failed++;
      console.error(JSON.stringify({ level: "error", event: "portal_purge_object_failed", message: err instanceof Error ? err.message : String(err) }));
    }
  }
  // Un objet resté en place bloque la suppression des lignes : nouvel essai au prochain passage.
  if (failed > 0) throw new Error(`portal_purge_incomplete:${failed}`);
  await db.query(`delete from portal_dossiers where id = $1`, [dossierId]);
  return n;
}
