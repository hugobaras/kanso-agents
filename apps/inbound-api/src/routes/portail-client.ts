import { createHash, randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { templates } from "@kanso/mailer";
import {
  CODE_MINUTES,
  MAX_PORTAL_FILE_BYTES,
  SESSION_DAYS,
  clientBaseUrl,
  encryptFile,
  fileAad,
  fileStorageKey,
  getStorage,
  hashCode,
  hashToken,
  issueLink,
  loadBrand,
  newLoginCode,
  recomputeStage,
  safeFilename,
  scanBuffer,
  sniffPortalMime,
  stageLabels,
  tenantKek,
  type Stage,
} from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { isLocalOrigin } from "../cors-origins.js";
import { appUrl, isProd, masterKey } from "../env.js";
import { body } from "../http/body.js";
import { HttpError, badRequest, forbidden, notFound } from "../http/errors.js";
import { RateLimiter, clientIp, rateLimit } from "../http/rate-limit.js";
import type { AppEnv } from "../http/types.js";
import { deliver } from "../services/mail.js";
import { cabinetRecipients, dossierUrl } from "../services/portail.js";

type Access = {
  link_id: string;
  contact_id: string;
  contact_name: string;
  contact_email: string;
  dossier_id: string;
  tenant_id: string;
  title: string;
  reference: string;
  client_name: string;
  stage: Stage;
  cabinet_message: string | null;
  assignee_user_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
};

const MAX_FILES_PER_ITEM = 10;
const MAX_CODE_ATTEMPTS = 5;

/** Un cookie par contact : plusieurs dossiers ouverts sur le même appareil ne s'écrasent pas. */
const cookieName = (contactId: string) => `kanso_portail_${contactId.replace(/-/g, "").slice(0, 12)}`;

function origins(): string[] {
  return [appUrl(), clientBaseUrl(), ...(process.env.KANSO_CORS_ORIGINS ?? "").split(",")].map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}

/** Même garde CSRF que l'app, ouverte à l'origine du portail client. */
function originGuard(c: Context<AppEnv>) {
  const m = c.req.method;
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;
  const origin = c.req.header("origin");
  if (!origin) {
    if (c.req.header("x-kanso-internal") === "1") return;
    throw forbidden("csrf_origin_missing");
  }
  const norm = origin.replace(/\/$/, "");
  if (origins().includes(norm) || (!isProd() && isLocalOrigin(norm))) return;
  throw forbidden("csrf_origin_mismatch");
}

async function findAccess(token: string, opts: { allowExpired?: boolean } = {}): Promise<Access | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const r = await getPool().query<Access>(
    `select l.id as link_id, l.expires_at, l.revoked_at, c.id as contact_id, c.name as contact_name, c.email::text as contact_email,
            d.id as dossier_id, d.tenant_id, d.title, d.reference, d.client_name, d.stage, d.cabinet_message, d.assignee_user_id
     from portal_links l join portal_contacts c on c.id = l.contact_id join portal_dossiers d on d.id = c.dossier_id
     where l.token_hash = $1`,
    [hashToken(token)],
  );
  const a = r.rows[0];
  if (!a) return null;
  if (!opts.allowExpired && (a.revoked_at || new Date(a.expires_at).getTime() < Date.now())) return null;
  return a;
}

function maskEmail(e: string): string {
  const [u = "", d = ""] = e.split("@");
  return `${u.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, u.length - 1)))}@${d}`;
}

async function requireSession(c: Context<AppEnv>, a: Access): Promise<void> {
  const raw = getCookie(c, cookieName(a.contact_id));
  if (!raw) throw new HttpError(401, "session_required", "Confirmez votre identité avec le code reçu par e-mail.");
  const r = await getPool().query<{ id: string }>(
    `select id from portal_client_sessions where token_hash = $1 and contact_id = $2 and revoked_at is null and expires_at > now()`,
    [hashToken(raw), a.contact_id],
  );
  if (!r.rows[0]) throw new HttpError(401, "session_required", "Confirmez votre identité avec le code reçu par e-mail.");
  await getPool().query(`update portal_client_sessions set last_seen_at = now() where id = $1`, [r.rows[0].id]);
}

export function portailClientRoutes(limiter: RateLimiter) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    originGuard(c);
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  });

  // ---- Entrée par le lien ------------------------------------------------------------------
  app.get("/link/:token", rateLimit(limiter, { name: "portail-link", limit: 60, windowSec: 600 }), async (c) => {
    const token = c.req.param("token");
    const a = await findAccess(token, { allowExpired: true });
    if (!a) throw notFound("link_invalid");
    const pool = getPool();
    const brand = await loadBrand(pool, a.tenant_id);
    const s = await pool.query<{ welcome_message: string | null; has_logo: boolean }>(
      `select welcome_message, (logo is not null) as has_logo from portal_settings where tenant_id = $1`,
      [a.tenant_id],
    );
    const expired = !!a.revoked_at || new Date(a.expires_at).getTime() < Date.now();
    const cookie = getCookie(c, cookieName(a.contact_id));
    let authenticated = false;
    if (cookie && !expired) {
      const r = await pool.query(`select 1 from portal_client_sessions where token_hash = $1 and contact_id = $2 and revoked_at is null and expires_at > now()`, [hashToken(cookie), a.contact_id]);
      authenticated = !!r.rows[0];
    }
    return c.json({
      state: expired ? "expired" : authenticated ? "authenticated" : "locked",
      brand: { ...brand, has_logo: !!s.rows[0]?.has_logo, welcome_message: s.rows[0]?.welcome_message ?? null },
      email_hint: maskEmail(a.contact_email),
    });
  });

  app.get("/link/:token/logo", async (c) => {
    const a = await findAccess(c.req.param("token"), { allowExpired: true });
    if (!a) throw notFound();
    const r = await getPool().query<{ logo: Buffer | null; logo_mime: string | null }>(`select logo, logo_mime from portal_settings where tenant_id = $1`, [a.tenant_id]);
    const row = r.rows[0];
    if (!row?.logo) throw notFound();
    return new Response(new Uint8Array(row.logo), { headers: { "Content-Type": row.logo_mime ?? "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300" } });
  });

  // Le client peut redemander un lien lui-même (même si l'ancien a expiré).
  app.post("/link/:token/resend", rateLimit(limiter, { name: "portail-resend-ip", limit: 10, windowSec: 3600 }), async (c) => {
    const a = await findAccess(c.req.param("token"), { allowExpired: true });
    if (a) {
      const { ok } = await limiter.hit(`portail-resend:${a.contact_id}`, 3, 3600);
      if (ok) {
        const brand = await loadBrand(getPool(), a.tenant_id);
        const link = await issueLink(getPool(), a.contact_id, { revokeOthers: true });
        await deliver(a.contact_email, templates.portalResend({ brand, clientName: a.contact_name, title: a.title, url: link.url, days: 7 }));
      }
    }
    return c.json({ ok: true });
  });

  // ---- Code à six chiffres ------------------------------------------------------------------
  app.post("/link/:token/code", rateLimit(limiter, { name: "portail-code-ip", limit: 20, windowSec: 3600 }), async (c) => {
    const a = await findAccess(c.req.param("token"));
    if (!a) throw new HttpError(410, "link_expired", "Ce lien n'est plus valable. Demandez-en un nouveau.");
    const { ok } = await limiter.hit(`portail-code:${a.contact_id}`, 5, 3600);
    if (!ok) throw new HttpError(429, "rate_limited", "Trop de demandes. Réessayez plus tard.");
    const code = newLoginCode();
    const pool = getPool();
    await pool.query(`update portal_login_codes set consumed_at = now() where contact_id = $1 and consumed_at is null`, [a.contact_id]);
    await pool.query(`insert into portal_login_codes (contact_id, code_hash, expires_at) values ($1, $2, now() + make_interval(mins => $3))`, [a.contact_id, hashCode(a.contact_id, code), CODE_MINUTES]);
    const brand = await loadBrand(pool, a.tenant_id);
    await deliver(a.contact_email, templates.portalCode({ brand, code }));
    return c.json({ ok: true, email_hint: maskEmail(a.contact_email) });
  });

  app.post("/link/:token/verify", rateLimit(limiter, { name: "portail-verify-ip", limit: 30, windowSec: 3600 }), async (c) => {
    const a = await findAccess(c.req.param("token"));
    if (!a) throw new HttpError(410, "link_expired", "Ce lien n'est plus valable. Demandez-en un nouveau.");
    const b = await body(c.req, z.object({ code: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres") }));
    const pool = getPool();
    const r = await pool.query<{ id: string; code_hash: string; attempts: number }>(
      `select id, code_hash, attempts from portal_login_codes where contact_id = $1 and consumed_at is null and expires_at > now() order by created_at desc limit 1`,
      [a.contact_id],
    );
    const row = r.rows[0];
    if (!row) throw new HttpError(400, "code_invalid", "Code expiré. Demandez-en un nouveau.");
    if (row.attempts >= MAX_CODE_ATTEMPTS) {
      await pool.query(`update portal_login_codes set consumed_at = now() where id = $1`, [row.id]);
      throw new HttpError(400, "code_invalid", "Trop d'essais. Demandez un nouveau code.");
    }
    const given = Buffer.from(hashCode(a.contact_id, b.code));
    const want = Buffer.from(row.code_hash);
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      await pool.query(`update portal_login_codes set attempts = attempts + 1 where id = $1`, [row.id]);
      throw new HttpError(400, "code_invalid", "Code incorrect.");
    }
    await pool.query(`update portal_login_codes set consumed_at = now() where id = $1`, [row.id]);
    const raw = randomBytes(32).toString("base64url");
    const expires = new Date(Math.min(Date.now() + SESSION_DAYS * 86_400_000, new Date(a.expires_at).getTime()));
    await pool.query(`insert into portal_client_sessions (contact_id, token_hash, expires_at) values ($1,$2,$3)`, [a.contact_id, hashToken(raw), expires]);
    await pool.query(`update portal_contacts set last_access_at = now() where id = $1`, [a.contact_id]);
    setCookie(c, cookieName(a.contact_id), raw, { httpOnly: true, secure: isProd(), sameSite: "Lax", path: "/", expires });
    return c.json({ ok: true });
  });

  app.post("/link/:token/logout", async (c) => {
    const a = await findAccess(c.req.param("token"), { allowExpired: true });
    if (a) {
      const raw = getCookie(c, cookieName(a.contact_id));
      if (raw) await getPool().query(`update portal_client_sessions set revoked_at = now() where token_hash = $1`, [hashToken(raw)]);
      deleteCookie(c, cookieName(a.contact_id), { path: "/" });
    }
    return c.json({ ok: true });
  });

  // ---- Dossier (session requise) -------------------------------------------------------------
  const d = new Hono<AppEnv>();
  d.use("*", async (c, next) => {
    const a = await findAccess(c.req.param("token") ?? "");
    if (!a) throw new HttpError(410, "link_expired", "Ce lien n'est plus valable. Demandez-en un nouveau.");
    await requireSession(c, a);
    c.set("portailAccess" as never, a as never);
    await next();
  });
  const access = (c: Context<AppEnv>) => c.get("portailAccess" as never) as unknown as Access;

  d.get("/", async (c) => {
    const a = access(c);
    const pool = getPool();
    const [brand, settings, items, files, messages] = await Promise.all([
      loadBrand(pool, a.tenant_id),
      pool.query(`select stage_labels, welcome_message, (logo is not null) as has_logo, retention_days from portal_settings where tenant_id = $1`, [a.tenant_id]),
      pool.query(`select id, label, hint, required, status, refusal_reason from portal_items where dossier_id = $1 order by position, label`, [a.dossier_id]),
      pool.query(`select id, item_id, filename, size_bytes, created_at from portal_files where dossier_id = $1 and deleted_at is null and scan_status = 'clean' order by created_at`, [a.dossier_id]),
      pool.query(`select id, author_kind, body, created_at from portal_messages where dossier_id = $1 order by created_at`, [a.dossier_id]),
    ]);
    const s = settings.rows[0];
    return c.json({
      brand: { ...brand, has_logo: !!s?.has_logo },
      dossier: { reference: a.reference, title: a.title, stage: a.stage, stage_label: stageLabels(s?.stage_labels)[a.stage], cabinet_message: a.cabinet_message },
      contact: { name: a.contact_name },
      stage_labels: stageLabels(s?.stage_labels),
      locked: a.stage === "termine",
      items: items.rows.map((i) => ({ ...i, files: files.rows.filter((f) => f.item_id === i.id) })),
      messages: messages.rows,
      max_file_mb: MAX_PORTAL_FILE_BYTES / 1024 / 1024,
    });
  });

  d.post(
    "/items/:itemId/files",
    rateLimit(limiter, { name: "portail-upload", limit: 60, windowSec: 3600, key: (c) => c.req.param("token") ?? clientIp(c) }),
    bodyLimit({
      maxSize: MAX_PORTAL_FILE_BYTES + 1024 * 1024,
      onError: (c) => c.json({ error: "file_too_large", message: "Fichier trop volumineux (20 Mo maximum)." }, 413),
    }),
    async (c) => {
      const a = access(c);
      if (a.stage === "termine") throw badRequest("dossier_closed", "Ce dossier est terminé.");
      const pool = getPool();
      const it = await pool.query<{ id: string; status: string }>(`select id, status from portal_items where id = $1 and dossier_id = $2`, [c.req.param("itemId"), a.dossier_id]);
      const item = it.rows[0];
      if (!item) throw notFound("item_not_found");
      if (item.status === "accepted") throw badRequest("item_accepted", "Cette pièce a déjà été acceptée.");
      const count = await pool.query<{ n: number }>(`select count(*)::int as n from portal_files where item_id = $1 and deleted_at is null`, [item.id]);
      if ((count.rows[0]?.n ?? 0) >= MAX_FILES_PER_ITEM) throw badRequest("too_many_files", `${MAX_FILES_PER_ITEM} fichiers maximum par pièce.`);

      const form = await c.req.parseBody();
      const file = form.file;
      if (!(file instanceof File)) throw badRequest("file_missing", "Aucun fichier reçu.");
      if (file.size === 0) throw badRequest("file_empty", "Le fichier est vide.");
      if (file.size > MAX_PORTAL_FILE_BYTES) throw new HttpError(413, "file_too_large", "Fichier trop volumineux (20 Mo maximum).");
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = sniffPortalMime(buf);
      if (!mime) throw new HttpError(415, "file_type", "Formats acceptés : PDF, JPEG, PNG ou WebP.");

      const scan = await scanBuffer(buf);
      if (scan.status === "infected") {
        console.warn(JSON.stringify({ level: "warn", event: "portail_infected_upload", tenant: a.tenant_id, dossier: a.dossier_id }));
        throw new HttpError(422, "file_infected", "Ce fichier a été refusé par l'analyse de sécurité.");
      }
      if (scan.status === "error") throw new HttpError(503, "scan_unavailable", "Dépôt momentanément indisponible. Réessayez dans quelques minutes.");

      const fileId = randomUUID();
      const aad = fileAad(a.tenant_id, a.dossier_id, fileId);
      const { blob, wrappedKey } = encryptFile(tenantKek(masterKey(), a.tenant_id), buf, aad);
      const key = fileStorageKey(a.tenant_id, a.dossier_id, fileId);
      await getStorage().put(key, blob);
      try {
        const name = safeFilename(file.name, mime);
        const sha = createHash("sha256").update(buf).digest("hex");
        await pool.query(
          `insert into portal_files (id, item_id, dossier_id, tenant_id, uploaded_by_contact, filename, mime_type, size_bytes, sha256, storage_key, wrapped_key)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [fileId, item.id, a.dossier_id, a.tenant_id, a.contact_id, name, mime, buf.length, sha, key, wrappedKey],
        );
      } catch (err) {
        await getStorage().delete(key).catch(() => undefined);
        throw err;
      }
      await pool.query(`update portal_items set status = 'received', refusal_reason = null, updated_at = now() where id = $1`, [item.id]);
      await pool.query(`update portal_dossiers set updated_at = now() where id = $1`, [a.dossier_id]);
      const res = await recomputeStage(pool, a.dossier_id);
      if (res.becameComplete) {
        const to = await cabinetRecipients(a.tenant_id, a.assignee_user_id);
        const ws = await pool.query<{ display_name: string }>(`select display_name from tenants where tenant_id = $1`, [a.tenant_id]);
        for (const email of to) {
          await deliver(email, templates.portalDossierComplete({ workspace: ws.rows[0]?.display_name ?? "", reference: a.reference, title: a.title, client: a.client_name || a.contact_name, url: dossierUrl(a.tenant_id, a.dossier_id) }));
        }
      }
      return c.json({ id: fileId, stage: res.stage }, 201);
    },
  );

  d.delete("/files/:fileId", async (c) => {
    const a = access(c);
    if (a.stage === "termine") throw badRequest("dossier_closed", "Ce dossier est terminé.");
    const pool = getPool();
    const r = await pool.query<{ id: string; item_id: string; storage_key: string; status: string }>(
      `select f.id, f.item_id, f.storage_key, i.status from portal_files f join portal_items i on i.id = f.item_id
       where f.id = $1 and f.dossier_id = $2 and f.deleted_at is null`,
      [c.req.param("fileId"), a.dossier_id],
    );
    const f = r.rows[0];
    if (!f) throw notFound("file_not_found");
    if (f.status === "accepted") throw badRequest("item_accepted", "Cette pièce a déjà été acceptée.");
    await getStorage().delete(f.storage_key);
    await pool.query(`update portal_files set deleted_at = now() where id = $1`, [f.id]);
    const left = await pool.query<{ n: number }>(`select count(*)::int as n from portal_files where item_id = $1 and deleted_at is null`, [f.item_id]);
    if ((left.rows[0]?.n ?? 0) === 0) await pool.query(`update portal_items set status = 'pending', updated_at = now() where id = $1`, [f.item_id]);
    return c.json({ stage: (await recomputeStage(pool, a.dossier_id)).stage });
  });

  d.post("/messages", rateLimit(limiter, { name: "portail-msg", limit: 20, windowSec: 3600, key: (c) => c.req.param("token") ?? clientIp(c) }), async (c) => {
    const a = access(c);
    const b = await body(c.req, z.object({ body: z.string().trim().min(1).max(1000) }));
    await getPool().query(`insert into portal_messages (dossier_id, tenant_id, author_kind, author_contact_id, body) values ($1,$2,'client',$3,$4)`, [a.dossier_id, a.tenant_id, a.contact_id, b.body]);
    await getPool().query(`update portal_dossiers set updated_at = now() where id = $1`, [a.dossier_id]);
    return c.json({ ok: true }, 201);
  });

  app.route("/d/:token", d);
  return app;
}
