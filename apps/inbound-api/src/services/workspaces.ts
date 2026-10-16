import { randomBytes } from "node:crypto";
import { TRIAL_DAYS } from "@kanso/billing";
import {
  buildDocumentTemplate,
  buildInboundTemplate,
  type Profession,
} from "@kanso/config";
import type { PoolClient } from "@kanso/tenancy";

export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `cabinet-${base || "kanso"}`;
}

const RESERVED = new Set(["admin", "api", "app", "www", "demo", "kanso", "support", "static"]);

export async function uniqueSlug(db: PoolClient, name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 && !RESERVED.has(base) ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const res = await db.query(`select 1 from tenants where tenant_id = $1`, [candidate]);
    if (res.rowCount === 0) return candidate;
  }
  throw new Error("slug_exhausted");
}

export function newWidgetPublicKey(mode: "live" | "test" = "live"): string {
  return `pk_${mode}_${randomBytes(18).toString("base64url")}`;
}

/**
 * Creates a full workspace in one transaction: tenant, owner membership,
 * 14-day trial, widget key, profession-based drafts (inbound + documents).
 */
export async function createWorkspace(
  db: PoolClient,
  opts: { name: string; profession: Profession; ownerUserId: string; ownerEmail: string },
): Promise<{ tenantId: string }> {
  const tenantId = await uniqueSlug(db, opts.name);
  await db.query(
    `insert into tenants (tenant_id, display_name, status, profession, modules)
     values ($1, $2, 'active', $3, '{"inbound": true, "document_to_action": true}'::jsonb)`,
    [tenantId, opts.name, opts.profession],
  );
  await db.query(`insert into memberships (tenant_id, user_id, role) values ($1, $2, 'owner')`, [
    tenantId,
    opts.ownerUserId,
  ]);
  await db.query(
    `insert into subscriptions (tenant_id, plan, status, trial_ends_at)
     values ($1, 'trial', 'trialing', now() + ($2::text || ' days')::interval)`,
    [tenantId, String(TRIAL_DAYS)],
  );
  await db.query(`insert into widget_keys (tenant_id, public_key, mode) values ($1, $2, 'live')`, [
    tenantId,
    newWidgetPublicKey("live"),
  ]);

  const inbound = buildInboundTemplate({ profession: opts.profession, displayName: opts.name });
  const documents = buildDocumentTemplate();
  await db.query(
    `insert into config_drafts (tenant_id, product, config, updated_by)
     values ($1, 'inbound', $2::jsonb, 'signup'), ($1, 'document_to_action', $3::jsonb, 'signup')`,
    [tenantId, JSON.stringify(inbound), JSON.stringify(documents)],
  );
  await db.query(
    `insert into audit_events (tenant_id, step, decision, summary, actor, correlation_id)
     values ($1, 'workspace', 'created', $2::jsonb, $3, $4)`,
    [tenantId, JSON.stringify({ profession: opts.profession }), opts.ownerEmail, `signup:${tenantId}`],
  );
  return { tenantId };
}
