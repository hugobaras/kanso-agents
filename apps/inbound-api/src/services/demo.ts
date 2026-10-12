import { buildInboundTemplate } from "@kanso/config";
import { getPool, loadPublishedConfig, publishConfig, withTransaction, type Pool } from "@kanso/tenancy";
import { newWidgetPublicKey } from "./workspaces.js";

export const DEMO_TENANT = "demo-public";

/** Idempotently provision the public demo workspace (marketing site widget). */
export async function ensureDemoTenant(pool: Pool = getPool()): Promise<{ publicKey: string }> {
  await withTransaction(pool, async (db) => {
    await db.query(
      `insert into tenants (tenant_id, display_name, status, profession, modules)
       values ($1, 'Cabinet Lefèvre & Associés (démo)', 'active', 'avocat', '{"inbound": true, "document_to_action": false}'::jsonb)
       on conflict (tenant_id) do nothing`,
      [DEMO_TENANT],
    );
    await db.query(
      `insert into subscriptions (tenant_id, plan, status) values ($1, 'expert', 'active')
       on conflict (tenant_id) do update set plan = 'expert', status = 'active'`,
      [DEMO_TENANT],
    );
    const key = await db.query(`select 1 from widget_keys where tenant_id = $1 and revoked_at is null`, [DEMO_TENANT]);
    if (key.rowCount === 0) {
      await db.query(`insert into widget_keys (tenant_id, public_key, mode) values ($1, $2, 'test')`, [
        DEMO_TENANT,
        newWidgetPublicKey("test"),
      ]);
    }
  });
  if (!(await loadPublishedConfig(pool, DEMO_TENANT, "inbound"))) {
    const cfg = buildInboundTemplate({ profession: "avocat", displayName: "Cabinet Lefèvre & Associés" });
    cfg.operations.after_hours_mode = "qualify";
    cfg.identity.welcome_message =
      "Bonjour ! Ceci est une démonstration : répondez comme un client et voyez ce que le cabinet reçoit.";
    await publishConfig(pool, { tenantId: DEMO_TENANT, product: "inbound", config: cfg, publishedBy: "system:demo" });
  }
  const res = await pool.query<{ public_key: string }>(
    `select public_key from widget_keys where tenant_id = $1 and revoked_at is null order by created_at desc limit 1`,
    [DEMO_TENANT],
  );
  return { publicKey: res.rows[0]!.public_key };
}

/** Hourly reset: the demo keeps no visitor data beyond an hour. */
export async function resetDemoTenant(pool: Pool = getPool()): Promise<void> {
  await pool.query(`delete from inbound_sessions where tenant_id = $1 and started_at < now() - interval '1 hour'`, [DEMO_TENANT]);
  await pool.query(`delete from notifications where tenant_id = $1 and created_at < now() - interval '1 hour'`, [DEMO_TENANT]);
  await pool.query(`delete from usage_counters where tenant_id = $1`, [DEMO_TENANT]);
}
