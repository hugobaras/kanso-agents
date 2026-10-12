import {
  parseInboundConfig,
  type InboundConfig,
} from "@kanso/config";
import type { Pool } from "@kanso/tenancy";

const DEFAULT_EMAIL_ON = ["hot_lead", "escalation", "handoff"] as const;
const DEFAULT_SLACK_ON = ["hot_lead", "escalation"] as const;

export async function loadPublishedInbound(
  pool: Pool,
  tenantId: string,
): Promise<{ config: InboundConfig; version: number; raw: unknown } | null> {
  const res = await pool.query<{ config: unknown; version: number }>(
    `select config, version from tenant_configs
     where tenant_id = $1 and product = 'inbound' and status = 'published'
     order by version desc limit 1`,
    [tenantId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    config: parseInboundConfig(row.config),
    version: row.version,
    raw: row.config,
  };
}

export async function republishInbound(
  pool: Pool,
  tenantId: string,
  config: InboundConfig,
  publishedBy: string,
): Promise<number> {
  parseInboundConfig(config);
  const versionRes = await pool.query<{ version: number }>(
    `select coalesce(max(version), 0) + 1 as version
     from tenant_configs where tenant_id = $1 and product = 'inbound'`,
    [tenantId],
  );
  const version = versionRes.rows[0]?.version ?? 1;
  await pool.query(
    `update tenant_configs set status = 'draft'
     where tenant_id = $1 and product = 'inbound' and status = 'published'`,
    [tenantId],
  );
  await pool.query(
    `insert into tenant_configs
      (tenant_id, product, version, schema_version, config, status, published_at, published_by)
     values ($1, 'inbound', $2, $3, $4::jsonb, 'published', now(), $5)`,
    [
      tenantId,
      version,
      config.schema_version,
      JSON.stringify(config),
      publishedBy,
    ],
  );
  return version;
}

export function upsertAlertChannel(
  config: InboundConfig,
  channel: {
    type: "email" | "slack";
    secret_ref: string;
    on?: readonly string[];
    enabled?: boolean;
  },
): InboundConfig {
  const on =
    channel.on ??
    (channel.type === "email" ? DEFAULT_EMAIL_ON : DEFAULT_SLACK_ON);
  const channels = [...config.alerts.channels];
  const idx = channels.findIndex((c) => c.type === channel.type);
  const next = {
    type: channel.type,
    secret_ref: channel.secret_ref,
    on: [...on] as InboundConfig["alerts"]["channels"][number]["on"],
    enabled: channel.enabled ?? true,
  };
  if (idx >= 0) channels[idx] = next;
  else channels.push(next);
  return { ...config, alerts: { ...config.alerts, channels } };
}

export function setChannelEnabled(
  config: InboundConfig,
  type: "email" | "slack",
  enabled: boolean,
): InboundConfig {
  const channels = config.alerts.channels.map((c) =>
    c.type === type ? { ...c, enabled } : c,
  );
  return { ...config, alerts: { ...config.alerts, channels } };
}

export function removeAlertChannel(
  config: InboundConfig,
  type: "email" | "slack",
): InboundConfig {
  return {
    ...config,
    alerts: {
      ...config.alerts,
      channels: config.alerts.channels.filter((c) => c.type !== type),
    },
  };
}

export const EMAIL_SECRET_REF = "alerts.intake_email";
export const SLACK_SECRET_REF = "alerts.intake_slack";
