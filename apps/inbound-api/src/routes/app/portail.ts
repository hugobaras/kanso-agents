import { templates } from "@kanso/mailer";
import {
  decryptFile,
  fileAad,
  findSystemTemplate,
  getStorage,
  issueLink,
  loadBrand,
  loadItems,
  progress,
  purgeDossier,
  recomputeStage,
  stageLabels,
  templatesFor,
  tenantKek,
  type Profession,
} from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { zipSync } from "fflate";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertActive, assertModule, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { masterKey } from "../../env.js";
import { body } from "../../http/body.js";
import { badRequest, HttpError, notFound } from "../../http/errors.js";
import type { AppEnv } from "../../http/types.js";
import { deliver } from "../../services/mail.js";
import { sendLinkEmail, type ContactRow, type DossierRow } from "../../services/portail.js";

const ItemInput = z.object({
  label: z.string().trim().min(1).max(160),
  hint: z.string().trim().max(300).optional().nullable(),
  required: z.boolean().default(true),
});
const ContactInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(120).default(""),
});

const ReminderSettings = z.object({
  enabled: z.boolean(),
  first_after_days: z.number().int().min(1).max(30),
  every_days: z.number().int().min(1).max(30),
  max: z.number().int().min(0).max(10),
});

const SettingsInput = z.object({
  display_name: z.string().trim().max(80).nullable().optional(),
  welcome_message: z.string().trim().max(500).nullable().optional(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  retention_days: z.number().int().min(7).max(3650).optional(),
  reminders: ReminderSettings.optional(),
  stage_labels: z
    .object({
      a_completer: z.string().trim().max(40).optional(),
      en_verification: z.string().trim().max(40).optional(),
      complet: z.string().trim().max(40).optional(),
      termine: z.string().trim().max(40).optional(),
    })
    .optional(),
});

async function ensureSettings(tenantId: string) {
  await getPool().query(`insert into portal_settings (tenant_id) values ($1) on conflict do nothing`, [tenantId]);
}

async function getDossier(tenantId: string, id: string): Promise<DossierRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("dossier_not_found");
  const r = await getPool().query<DossierRow>(`select * from portal_dossiers where id = $1 and tenant_id = $2`, [id, tenantId]);
  if (!r.rows[0]) throw notFound("dossier_not_found");
  return r.rows[0];
}

async function activeCount(tenantId: string): Promise<number> {
  const r = await getPool().query<{ n: number }>(`select count(*)::int as n from portal_dossiers where tenant_id = $1 and stage <> 'termine'`, [tenantId]);
  return r.rows[0]?.n ?? 0;
}

export function portailRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    assertModule(c, "portail");
    // Sans abonnement actif : lecture, export, clôture et suppression seulement (le cabinet récupère ses pièces).
    const m = c.req.method;
    const p = c.req.path.replace(/\/$/, "");
    const allowed = (m === "DELETE" && /\/dossiers\/[^/]+$/.test(p)) || (m === "POST" && /\/dossiers\/[^/]+\/close$/.test(p));
    if (m !== "GET" && !allowed) assertActive(c);
    await next();
  });

  // ---- Vue d'ensemble ------------------------------------------------------------
  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    await ensureSettings(ws.tenantId);
    const pool = getPool();
    const stage = c.req.query("stage");
    const q = (c.req.query("q") ?? "").trim().slice(0, 100);
    const params: unknown[] = [ws.tenantId];
    let where = "d.tenant_id = $1";
    if (stage && ["a_completer", "en_verification", "complet", "termine"].includes(stage)) {
      params.push(stage);
      where += ` and d.stage = $${params.length}`;
    }
    if (q) {
      params.push(`%${q.replace(/[%_\\]/g, "\\$&")}%`);
      where += ` and (d.title ilike $${params.length} or d.client_name ilike $${params.length} or d.reference ilike $${params.length})`;
    }
    const [rows, settings, active] = await Promise.all([
      pool.query(
        `select d.id, d.reference, d.title, d.client_name, d.client_kind, d.stage, d.updated_at, d.created_at, d.purge_at,
                (select count(*)::int from portal_items i where i.dossier_id = d.id) as items_total,
                (select count(*)::int from portal_items i where i.dossier_id = d.id and i.status in ('received','accepted')) as items_provided,
                (select count(*)::int from portal_messages m where m.dossier_id = d.id and m.author_kind = 'client' and m.seen_by_other_at is null) as unread_messages
         from portal_dossiers d where ${where} order by d.updated_at desc limit 200`,
        params,
      ),
      pool.query(`select max_active_dossiers, stage_labels, retention_days from portal_settings where tenant_id = $1`, [ws.tenantId]),
      activeCount(ws.tenantId),
    ]);
    const s = settings.rows[0];
    return c.json({
      dossiers: rows.rows,
      active: active,
      max_active: s?.max_active_dossiers ?? 20,
      stage_labels: stageLabels(s?.stage_labels),
    });
  });

  // ---- Réglages ---------------------------------------------------------------------
  app.get("/settings", async (c) => {
    const ws = currentWorkspace(c);
    await ensureSettings(ws.tenantId);
    const r = await getPool().query(
      `select max_active_dossiers, retention_days, reminders, stage_labels, brand_color, display_name, welcome_message,
              (logo is not null) as has_logo from portal_settings where tenant_id = $1`,
      [ws.tenantId],
    );
    const s = r.rows[0];
    return c.json({ ...s, stage_labels: stageLabels(s.stage_labels), workspace_name: ws.displayName });
  });

  app.put("/settings", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    await ensureSettings(ws.tenantId);
    const b = await body(c.req, SettingsInput);
    const sets: string[] = [];
    const params: unknown[] = [ws.tenantId];
    const add = (col: string, v: unknown, cast = "") => {
      params.push(v);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (b.display_name !== undefined) add("display_name", b.display_name || null);
    if (b.welcome_message !== undefined) add("welcome_message", b.welcome_message || null);
    if (b.brand_color !== undefined) add("brand_color", b.brand_color);
    if (b.retention_days !== undefined) add("retention_days", b.retention_days);
    if (b.reminders) add("reminders", JSON.stringify(b.reminders), "::jsonb");
    if (b.stage_labels) add("stage_labels", JSON.stringify(b.stage_labels), "::jsonb");
    if (sets.length) {
      await getPool().query(`update portal_settings set ${sets.join(", ")}, updated_at = now() where tenant_id = $1`, params);
      await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.settings", decision: "updated", summary: { fields: Object.keys(b) } });
    }
    return c.json({ ok: true });
  });

  app.post("/settings/logo", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    await ensureSettings(ws.tenantId);
    const buf = Buffer.from(await c.req.arrayBuffer());
    if (buf.length === 0 || buf.length > 300 * 1024) throw badRequest("logo_size", "Logo : 300 Ko maximum.");
    const mime = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ? "image/png"
      : buf[0] === 0xff && buf[1] === 0xd8
        ? "image/jpeg"
        : buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;
    if (!mime) throw badRequest("logo_type", "Logo : PNG, JPEG ou WebP.");
    await getPool().query(`update portal_settings set logo = $2, logo_mime = $3, updated_at = now() where tenant_id = $1`, [ws.tenantId, buf, mime]);
    return c.json({ ok: true });
  });

  app.delete("/settings/logo", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    await getPool().query(`update portal_settings set logo = null, logo_mime = null where tenant_id = $1`, [ws.tenantId]);
    return c.json({ ok: true });
  });

  app.get("/settings/logo", async (c) => {
    const ws = currentWorkspace(c);
    const r = await getPool().query<{ logo: Buffer | null; logo_mime: string | null }>(`select logo, logo_mime from portal_settings where tenant_id = $1`, [ws.tenantId]);
    const row = r.rows[0];
    if (!row?.logo) throw notFound("logo_not_found");
    return new Response(new Uint8Array(row.logo), { headers: { "Content-Type": row.logo_mime ?? "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=60" } });
  });

  // ---- Modèles ---------------------------------------------------------------------------
  app.get("/templates", async (c) => {
    const ws = currentWorkspace(c);
    const custom = await getPool().query(
      `select id, name, description, items from portal_templates where tenant_id = $1 order by name`,
      [ws.tenantId],
    );
    return c.json({
      system: templatesFor(ws.profession as Profession | null).map((t) => ({ key: t.key, name: t.name, description: t.description, client_kind: t.clientKind, items: t.items })),
      custom: custom.rows,
    });
  });

  const TemplateInput = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(300).optional().nullable(),
    items: z.array(ItemInput).max(60),
  });

  app.post("/templates", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(c.req, TemplateInput);
    const r = await getPool().query(
      `insert into portal_templates (tenant_id, profession, name, description, items, created_by) values ($1,$2,$3,$4,$5::jsonb,$6) returning id`,
      [ws.tenantId, ws.profession, b.name, b.description ?? null, JSON.stringify(b.items), currentUser(c).id],
    );
    return c.json({ id: r.rows[0].id }, 201);
  });

  app.put("/templates/:id", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const b = await body(c.req, TemplateInput);
    const r = await getPool().query(
      `update portal_templates set name=$3, description=$4, items=$5::jsonb, updated_at=now() where id=$1 and tenant_id=$2`,
      [c.req.param("id"), ws.tenantId, b.name, b.description ?? null, JSON.stringify(b.items)],
    );
    if (!r.rowCount) throw notFound("template_not_found");
    return c.json({ ok: true });
  });

  app.delete("/templates/:id", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    await getPool().query(`delete from portal_templates where id=$1 and tenant_id=$2`, [c.req.param("id"), ws.tenantId]);
    return c.json({ ok: true });
  });

  // ---- Dossiers --------------------------------------------------------------------------
  const CreateInput = z.object({
    title: z.string().trim().min(1).max(160),
    client_name: z.string().trim().max(160).default(""),
    client_kind: z.enum(["particulier", "entreprise"]).default("particulier"),
    template: z.string().max(80).optional(),
    items: z.array(ItemInput).max(60).optional(),
    contacts: z.array(ContactInput).min(1).max(5),
    message: z.string().trim().max(1000).optional().nullable(),
    lead_id: z.string().uuid().optional().nullable(),
    send: z.boolean().default(true),
  });

  app.post("/dossiers", async (c) => {
    const ws = currentWorkspace(c);
    const user = currentUser(c);
    const b = await body(c.req, CreateInput);
    const pool = getPool();
    await ensureSettings(ws.tenantId);

    const lim = await pool.query<{ max_active_dossiers: number }>(`select max_active_dossiers from portal_settings where tenant_id = $1`, [ws.tenantId]);
    const max = lim.rows[0]?.max_active_dossiers ?? 20;
    if ((await activeCount(ws.tenantId)) >= max) {
      throw new HttpError(409, "dossier_limit", `Vous avez atteint ${max} dossiers actifs. Terminez un dossier pour en ouvrir un nouveau, ou contactez-nous pour augmenter la limite.`);
    }

    let items = b.items;
    if (!items && b.template) {
      const sys = findSystemTemplate(b.template);
      if (sys) items = sys.items.map((i) => ({ label: i.label, hint: i.hint ?? null, required: i.required }));
      else if (/^[0-9a-f-]{36}$/i.test(b.template)) {
        const t = await pool.query<{ items: Array<z.infer<typeof ItemInput>> }>(`select items from portal_templates where id = $1 and tenant_id = $2`, [b.template, ws.tenantId]);
        if (!t.rows[0]) throw badRequest("template_not_found");
        items = t.rows[0].items;
      } else throw badRequest("template_not_found");
    }
    items ??= [];

    if (b.lead_id) {
      const l = await pool.query(`select 1 from leads where id = $1 and tenant_id = $2`, [b.lead_id, ws.tenantId]);
      if (!l.rows[0]) throw badRequest("lead_not_found");
    }

    const client = await (pool as unknown as { connect(): Promise<{ query: typeof pool.query; release(): void }> }).connect();
    let dossier: DossierRow;
    let contacts: ContactRow[] = [];
    try {
      await client.query("begin");
      const seq = await client.query<{ n: number }>(
        `update portal_settings set next_dossier_seq = next_dossier_seq + 1 where tenant_id = $1 returning next_dossier_seq - 1 as n`,
        [ws.tenantId],
      );
      const reference = `D-${new Date().getFullYear()}-${String(seq.rows[0]!.n).padStart(3, "0")}`;
      const d = await client.query<DossierRow>(
        `insert into portal_dossiers (tenant_id, reference, title, client_name, client_kind, cabinet_message, assignee_user_id, lead_id, source, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$7) returning *`,
        [ws.tenantId, reference, b.title, b.client_name, b.client_kind, b.message || null, user.id, b.lead_id ?? null, b.lead_id ? "assistant" : "manual"],
      );
      dossier = d.rows[0]!;
      for (const [idx, it] of items.entries()) {
        await client.query(
          `insert into portal_items (dossier_id, tenant_id, position, label, hint, required) values ($1,$2,$3,$4,$5,$6)`,
          [dossier.id, ws.tenantId, idx, it.label, it.hint ?? null, it.required],
        );
      }
      for (const ct of b.contacts) {
        const r = await client.query<ContactRow>(
          `insert into portal_contacts (dossier_id, tenant_id, email, name) values ($1,$2,$3,$4)
           on conflict (dossier_id, email) do update set name = excluded.name returning id, dossier_id, email::text as email, name`,
          [dossier.id, ws.tenantId, ct.email, ct.name],
        );
        contacts.push(r.rows[0]!);
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.dossier", decision: "created", summary: { dossier: dossier.id, reference: dossier.reference } });
    if (b.send) for (const ct of contacts) await sendLinkEmail(dossier, ct, "invite");
    return c.json({ id: dossier.id, reference: dossier.reference }, 201);
  });

  app.get("/dossiers/:id", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const pool = getPool();
    const [items, files, contacts, messages, settings] = await Promise.all([
      loadItems(pool, d.id),
      pool.query(
        `select f.id, f.item_id, f.filename, f.mime_type, f.size_bytes, f.created_at, f.uploaded_by_contact
         from portal_files f where f.dossier_id = $1 and f.deleted_at is null and f.scan_status = 'clean' order by f.created_at`,
        [d.id],
      ),
      pool.query(`select id, email::text as email, name, last_access_at from portal_contacts where dossier_id = $1 order by created_at`, [d.id]),
      pool.query(`select id, author_kind, body, created_at from portal_messages where dossier_id = $1 order by created_at`, [d.id]),
      pool.query(`select stage_labels from portal_settings where tenant_id = $1`, [ws.tenantId]),
    ]);
    const full = await pool.query(`select id, label, hint, required, status, refusal_reason, position from portal_items where dossier_id = $1 order by position, label`, [d.id]);
    await pool.query(`update portal_messages set seen_by_other_at = now() where dossier_id = $1 and author_kind = 'client' and seen_by_other_at is null`, [d.id]);
    return c.json({
      dossier: d,
      stage_labels: stageLabels(settings.rows[0]?.stage_labels),
      items: full.rows.map((i) => ({ ...i, files: files.rows.filter((f) => f.item_id === i.id) })),
      progress: progress(items.map((i) => ({ required: i.required, status: i.status, hasFile: i.files > 0 }))),
      contacts: contacts.rows,
      messages: messages.rows,
    });
  });

  app.patch("/dossiers/:id", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const b = await body(
      c.req,
      z.object({
        title: z.string().trim().min(1).max(160).optional(),
        client_name: z.string().trim().max(160).optional(),
        cabinet_message: z.string().trim().max(1000).nullable().optional(),
        assignee_user_id: z.string().uuid().nullable().optional(),
      }),
    );
    if (b.assignee_user_id) {
      const m = await getPool().query(`select 1 from memberships where user_id = $1 and tenant_id = $2`, [b.assignee_user_id, ws.tenantId]);
      if (!m.rows[0]) throw badRequest("assignee_invalid");
    }
    await getPool().query(
      `update portal_dossiers set title = coalesce($2, title), client_name = coalesce($3, client_name),
         cabinet_message = case when $4::boolean then $5 else cabinet_message end,
         assignee_user_id = case when $6::boolean then $7::uuid else assignee_user_id end, updated_at = now() where id = $1`,
      [d.id, b.title ?? null, b.client_name ?? null, b.cabinet_message !== undefined, b.cabinet_message ?? null, b.assignee_user_id !== undefined, b.assignee_user_id ?? null],
    );
    return c.json({ ok: true });
  });

  // ---- Pièces ---------------------------------------------------------------------------------
  app.post("/dossiers/:id/items", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const b = await body(c.req, ItemInput);
    const pos = await getPool().query<{ n: number }>(`select coalesce(max(position), -1) + 1 as n from portal_items where dossier_id = $1`, [d.id]);
    const r = await getPool().query(
      `insert into portal_items (dossier_id, tenant_id, position, label, hint, required) values ($1,$2,$3,$4,$5,$6) returning id`,
      [d.id, ws.tenantId, pos.rows[0]!.n, b.label, b.hint ?? null, b.required],
    );
    if (d.stage !== "termine") await recomputeStage(getPool(), d.id);
    return c.json({ id: r.rows[0].id }, 201);
  });

  async function getItem(tenantId: string, dossierId: string, itemId: string) {
    const r = await getPool().query(`select * from portal_items where id = $1 and dossier_id = $2 and tenant_id = $3`, [itemId, dossierId, tenantId]);
    if (!r.rows[0]) throw notFound("item_not_found");
    return r.rows[0] as { id: string; label: string; status: string };
  }

  app.patch("/dossiers/:id/items/:itemId", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const it = await getItem(ws.tenantId, d.id, c.req.param("itemId"));
    const b = await body(c.req, ItemInput.partial());
    await getPool().query(
      `update portal_items set label = coalesce($2, label), hint = case when $3::boolean then $4 else hint end,
         required = coalesce($5, required), updated_at = now() where id = $1`,
      [it.id, b.label ?? null, b.hint !== undefined, b.hint ?? null, b.required ?? null],
    );
    await recomputeStage(getPool(), d.id);
    return c.json({ ok: true });
  });

  app.delete("/dossiers/:id/items/:itemId", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const it = await getItem(ws.tenantId, d.id, c.req.param("itemId"));
    const files = await getPool().query<{ storage_key: string }>(`select storage_key from portal_files where item_id = $1`, [it.id]);
    for (const f of files.rows) await getStorage().delete(f.storage_key);
    await getPool().query(`delete from portal_items where id = $1`, [it.id]);
    await recomputeStage(getPool(), d.id);
    return c.json({ ok: true });
  });

  app.post("/dossiers/:id/items/:itemId/accept", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const it = await getItem(ws.tenantId, d.id, c.req.param("itemId"));
    const f = await getPool().query(`select 1 from portal_files where item_id = $1 and deleted_at is null and scan_status = 'clean' limit 1`, [it.id]);
    if (!f.rows[0]) throw badRequest("no_file", "Aucun document n'a été déposé pour cette pièce.");
    await getPool().query(`update portal_items set status='accepted', refusal_reason=null, reviewed_by=$2, reviewed_at=now(), updated_at=now() where id=$1`, [it.id, currentUser(c).id]);
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.item", decision: "accepted", summary: { dossier: d.id, item: it.id } });
    return c.json({ stage: (await recomputeStage(getPool(), d.id)).stage });
  });

  app.post("/dossiers/:id/items/:itemId/refuse", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const it = await getItem(ws.tenantId, d.id, c.req.param("itemId"));
    const b = await body(c.req, z.object({ reason: z.string().trim().max(400).default("") }));
    await getPool().query(`update portal_items set status='refused', refusal_reason=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now() where id=$1`, [it.id, b.reason || null, currentUser(c).id]);
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.item", decision: "refused", summary: { dossier: d.id, item: it.id } });
    const stage = (await recomputeStage(getPool(), d.id)).stage;
    const [brand, contacts] = await Promise.all([
      loadBrand(getPool(), ws.tenantId),
      getPool().query<ContactRow>(`select id, dossier_id, email::text as email, name from portal_contacts where dossier_id = $1`, [d.id]),
    ]);
    for (const ct of contacts.rows) {
      const link = await issueLink(getPool(), ct.id);
      await deliver(ct.email, templates.portalRefusal({ brand, clientName: ct.name, title: d.title, url: link.url, label: it.label, reason: b.reason }));
    }
    return c.json({ stage });
  });

  // ---- Contacts ----------------------------------------------------------------------------------
  app.post("/dossiers/:id/contacts", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const b = await body(c.req, ContactInput);
    const n = await getPool().query<{ n: number }>(`select count(*)::int as n from portal_contacts where dossier_id = $1`, [d.id]);
    if ((n.rows[0]?.n ?? 0) >= 5) throw badRequest("contact_limit", "5 adresses maximum par dossier.");
    const r = await getPool().query<ContactRow>(
      `insert into portal_contacts (dossier_id, tenant_id, email, name) values ($1,$2,$3,$4)
       on conflict (dossier_id, email) do update set name = excluded.name returning id, dossier_id, email::text as email, name`,
      [d.id, ws.tenantId, b.email, b.name],
    );
    await sendLinkEmail(d, r.rows[0]!, "invite");
    return c.json({ id: r.rows[0]!.id }, 201);
  });

  app.post("/dossiers/:id/contacts/:contactId/resend", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const r = await getPool().query<ContactRow>(
      `select id, dossier_id, email::text as email, name from portal_contacts where id = $1 and dossier_id = $2`,
      [c.req.param("contactId"), d.id],
    );
    if (!r.rows[0]) throw notFound("contact_not_found");
    await sendLinkEmail(d, r.rows[0], "resend");
    return c.json({ ok: true });
  });

  app.delete("/dossiers/:id/contacts/:contactId", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const cnt = await getPool().query<{ n: number }>(`select count(*)::int as n from portal_contacts where dossier_id = $1`, [d.id]);
    if ((cnt.rows[0]?.n ?? 0) <= 1) throw badRequest("last_contact", "Un dossier doit garder au moins une adresse.");
    await getPool().query(`delete from portal_contacts where id = $1 and dossier_id = $2`, [c.req.param("contactId"), d.id]);
    return c.json({ ok: true });
  });

  // ---- Fichiers ----------------------------------------------------------------------------------
  async function readFile(tenantId: string, dossierId: string, fileId: string) {
    const r = await getPool().query<{ id: string; filename: string; mime_type: string; storage_key: string; wrapped_key: Buffer; item_label?: string }>(
      `select f.id, f.filename, f.mime_type, f.storage_key, f.wrapped_key from portal_files f
       where f.id = $1 and f.dossier_id = $2 and f.tenant_id = $3 and f.deleted_at is null and f.scan_status = 'clean'`,
      [fileId, dossierId, tenantId],
    );
    const f = r.rows[0];
    if (!f) throw notFound("file_not_found");
    const blob = await getStorage().get(f.storage_key);
    const data = decryptFile(tenantKek(masterKey(), tenantId), blob, f.wrapped_key, fileAad(tenantId, dossierId, f.id));
    return { f, data };
  }

  app.get("/dossiers/:id/files/:fileId", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const { f, data } = await readFile(ws.tenantId, d.id, c.req.param("fileId"));
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.file", decision: "downloaded", summary: { dossier: d.id, file: f.id } });
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": f.mime_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  });

  app.get("/dossiers/:id/export", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const rows = await getPool().query<{ id: string; label: string }>(
      `select f.id, i.label from portal_files f join portal_items i on i.id = f.item_id
       where f.dossier_id = $1 and f.deleted_at is null and f.scan_status = 'clean' order by i.position, f.created_at`,
      [d.id],
    );
    const entries: Record<string, Uint8Array> = {};
    for (const r of rows.rows) {
      const { f, data } = await readFile(ws.tenantId, d.id, r.id);
      const folder = r.label.replace(/[^\p{L}\p{N} _.-]/gu, "_").slice(0, 60) || "pieces";
      let name = `${folder}/${f.filename}`;
      for (let n = 2; entries[name]; n++) name = `${folder}/${n}-${f.filename}`;
      entries[name] = new Uint8Array(data);
    }
    if (Object.keys(entries).length === 0) throw badRequest("empty_export", "Aucun document à exporter.");
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.dossier", decision: "exported", summary: { dossier: d.id, files: rows.rows.length } });
    const zip = zipSync(entries, { level: 0 });
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${d.reference}.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  });

  // ---- Messages et clôture ------------------------------------------------------------------------
  app.post("/dossiers/:id/messages", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const b = await body(c.req, z.object({ body: z.string().trim().min(1).max(1000) }));
    await getPool().query(`insert into portal_messages (dossier_id, tenant_id, author_kind, author_user_id, body) values ($1,$2,'cabinet',$3,$4)`, [d.id, ws.tenantId, currentUser(c).id, b.body]);
    await getPool().query(`update portal_dossiers set updated_at = now() where id = $1`, [d.id]);
    const [brand, contacts] = await Promise.all([
      loadBrand(getPool(), ws.tenantId),
      getPool().query<ContactRow>(`select id, dossier_id, email::text as email, name from portal_contacts where dossier_id = $1`, [d.id]),
    ]);
    for (const ct of contacts.rows) {
      const link = await issueLink(getPool(), ct.id);
      await deliver(ct.email, templates.portalCabinetMessage({ brand, clientName: ct.name, title: d.title, url: link.url, body: b.body }));
    }
    return c.json({ ok: true }, 201);
  });

  app.post("/dossiers/:id/close", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    const s = await getPool().query<{ retention_days: number }>(`select retention_days from portal_settings where tenant_id = $1`, [ws.tenantId]);
    const days = s.rows[0]?.retention_days ?? 90;
    await getPool().query(
      `update portal_dossiers set stage = 'termine', closed_at = now(), purge_at = now() + make_interval(days => $2), purge_notified_at = null, updated_at = now() where id = $1`,
      [d.id, days],
    );
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.dossier", decision: "closed", summary: { dossier: d.id } });
    return c.json({ ok: true });
  });

  app.post("/dossiers/:id/reopen", async (c) => {
    const ws = currentWorkspace(c);
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    if ((await activeCount(ws.tenantId)) >= 1) {
      const lim = await getPool().query<{ max_active_dossiers: number }>(`select max_active_dossiers from portal_settings where tenant_id = $1`, [ws.tenantId]);
      if ((await activeCount(ws.tenantId)) >= (lim.rows[0]?.max_active_dossiers ?? 20)) throw new HttpError(409, "dossier_limit", "Limite de dossiers actifs atteinte.");
    }
    await getPool().query(`update portal_dossiers set stage = 'a_completer', closed_at = null, purge_at = null, purge_notified_at = null, updated_at = now() where id = $1`, [d.id]);
    await recomputeStage(getPool(), d.id);
    return c.json({ ok: true });
  });

  app.delete("/dossiers/:id", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const d = await getDossier(ws.tenantId, c.req.param("id"));
    await purgeDossier(getPool(), d.id);
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "portail.dossier", decision: "deleted", summary: { dossier: d.id, reference: d.reference } });
    return c.json({ ok: true });
  });

  return app;
}
