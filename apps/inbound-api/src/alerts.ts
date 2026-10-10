import type { InboundConfig } from "@kanso/config";
import {
  createEmailAlertAdapter,
  createSlackAlertAdapter,
  withAdapterRetry,
} from "@kanso/adapters";
import {
  getPool,
  PostgresSecretStore,
  type AuthContext,
} from "@kanso/tenancy";

export type ChannelDelivery = {
  type: "email" | "slack";
  delivered: boolean;
  mode: "smtp" | "console" | "webhook" | "skipped";
  error?: string;
};

export async function dispatchInboundAlert(opts: {
  tenantId: string;
  sessionId: string;
  configVersion: number;
  config: InboundConfig;
  event: string;
  scoreFinal: number | null;
}): Promise<{
  delivered: boolean;
  mode: string;
  channels: ChannelDelivery[];
  error?: string;
}> {
  const channels = opts.config.alerts.channels.filter((c) =>
    (c.on as string[]).includes(opts.event),
  );
  if (channels.length === 0) {
    return {
      delivered: false,
      mode: "skipped",
      channels: [],
      error: "no_channel_for_event",
    };
  }

  const masterKey = process.env.KANSO_MASTER_KEY;
  if (!masterKey) {
    return {
      delivered: false,
      mode: "skipped",
      channels: [],
      error: "missing_master_key",
    };
  }

  const pool = getPool();
  const secrets = new PostgresSecretStore(pool, masterKey);
  const results: ChannelDelivery[] = [];

  for (const channel of channels) {
    if (channel.type === "email") {
      results.push(
        await sendEmailChannel({
          secrets,
          tenantId: opts.tenantId,
          sessionId: opts.sessionId,
          configVersion: opts.configVersion,
          secretRef: channel.secret_ref,
          event: opts.event,
          scoreFinal: opts.scoreFinal,
        }),
      );
    } else if (channel.type === "slack") {
      results.push(
        await sendSlackChannel({
          secrets,
          tenantId: opts.tenantId,
          sessionId: opts.sessionId,
          configVersion: opts.configVersion,
          secretRef: channel.secret_ref,
          event: opts.event,
          scoreFinal: opts.scoreFinal,
        }),
      );
    }
  }

  const delivered = results.some((r) => r.delivered);
  const modes = results.map((r) => `${r.type}:${r.mode}`).join(",");
  return {
    delivered,
    mode: modes || "skipped",
    channels: results,
    error: delivered
      ? undefined
      : results.map((r) => r.error).filter(Boolean).join("; ") || undefined,
  };
}

async function sendEmailChannel(opts: {
  secrets: PostgresSecretStore;
  tenantId: string;
  sessionId: string;
  configVersion: number;
  secretRef: string;
  event: string;
  scoreFinal: number | null;
}): Promise<ChannelDelivery> {
  let auth: AuthContext;
  try {
    auth = await opts.secrets.resolve(opts.tenantId, "email", opts.secretRef);
  } catch (err) {
    return {
      type: "email",
      delivered: false,
      mode: "skipped",
      error: err instanceof Error ? err.message : "secret_resolve_failed",
    };
  }

  const adapter = createEmailAlertAdapter(auth);
  const mode = auth.credentials.host ? "smtp" : "console";
  const result = await withAdapterRetry((attempt) =>
    adapter.send(
      {
        channel: "email",
        event: opts.event,
        title: `Lead ${opts.tenantId}`,
        body: `score_final=${opts.scoreFinal ?? ""}`,
        metadata: {
          score: opts.scoreFinal ?? 0,
          session_id: opts.sessionId,
        },
      },
      auth,
      {
        tenantId: opts.tenantId,
        correlationId: opts.sessionId,
        configVersion: opts.configVersion,
        attempt,
      },
    ),
  );

  if (result.status !== "ok") {
    return { type: "email", delivered: false, mode, error: result.message };
  }
  return { type: "email", delivered: true, mode };
}

async function sendSlackChannel(opts: {
  secrets: PostgresSecretStore;
  tenantId: string;
  sessionId: string;
  configVersion: number;
  secretRef: string;
  event: string;
  scoreFinal: number | null;
}): Promise<ChannelDelivery> {
  let auth: AuthContext;
  try {
    auth = await opts.secrets.resolve(opts.tenantId, "slack", opts.secretRef);
  } catch (err) {
    return {
      type: "slack",
      delivered: false,
      mode: "skipped",
      error: err instanceof Error ? err.message : "secret_resolve_failed",
    };
  }

  const adapter = createSlackAlertAdapter(auth);
  const mode = auth.credentials.webhook_url ? "webhook" : "console";
  const result = await withAdapterRetry((attempt) =>
    adapter.send(
      {
        channel: "slack",
        event: opts.event,
        title: `Lead ${opts.tenantId}`,
        body: `score_final=${opts.scoreFinal ?? ""}`,
        metadata: {
          score: opts.scoreFinal ?? 0,
          session_id: opts.sessionId,
        },
      },
      auth,
      {
        tenantId: opts.tenantId,
        correlationId: opts.sessionId,
        configVersion: opts.configVersion,
        attempt,
      },
    ),
  );

  if (result.status !== "ok") {
    return { type: "slack", delivered: false, mode, error: result.message };
  }
  return { type: "slack", delivered: true, mode };
}
