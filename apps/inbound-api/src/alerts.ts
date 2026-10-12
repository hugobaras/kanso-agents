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
import { recordDemoAlert } from "./demo-ops.js";

export type ChannelDelivery = {
  type: "email" | "slack";
  delivered: boolean;
  mode: "smtp" | "console" | "webhook" | "skipped";
  error?: string;
  title?: string;
  body?: string;
};

export async function dispatchInboundAlert(opts: {
  tenantId: string;
  sessionId: string;
  configVersion: number;
  config: InboundConfig;
  event: string;
  scoreFinal: number | null;
  answers?: Record<string, unknown>;
}): Promise<{
  delivered: boolean;
  mode: string;
  channels: ChannelDelivery[];
  error?: string;
  title: string;
  body: string;
}> {
  const answers = opts.answers ?? {};
  const title = `[Kanso] ${opts.event} — ${opts.config.identity.display_name}`;
  const body = [
    `Tenant: ${opts.tenantId}`,
    `Cabinet: ${opts.config.identity.display_name}`,
    `Événement: ${opts.event}`,
    `Score final: ${opts.scoreFinal ?? "n/a"} / ${opts.config.scoring.max_score}`,
    `Seuil hot: ${opts.config.scoring.thresholds.hot}`,
    `Session: ${opts.sessionId}`,
    `Réponses: ${JSON.stringify(answers, null, 2)}`,
  ].join("\n");

  const channels = opts.config.alerts.channels.filter((c) =>
    (c.on as string[]).includes(opts.event),
  );
  if (channels.length === 0) {
    const skipped = {
      delivered: false,
      mode: "skipped",
      channels: [] as ChannelDelivery[],
      error: "no_channel_for_event",
      title,
      body,
    };
    recordDemoAlert({
      tenant_id: opts.tenantId,
      session_id: opts.sessionId,
      event: opts.event,
      score_final: opts.scoreFinal,
      answers,
      channels: [],
      mode: "skipped",
      delivered: false,
      title,
      body,
    });
    return skipped;
  }

  const masterKey = process.env.KANSO_MASTER_KEY;
  if (!masterKey) {
    return {
      delivered: false,
      mode: "skipped",
      channels: [],
      error: "missing_master_key",
      title,
      body,
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
          title,
          body,
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
          title,
          body,
        }),
      );
    }
  }

  const delivered = results.some((r) => r.delivered);
  const modes = results.map((r) => `${r.type}:${r.mode}`).join(",");
  const out = {
    delivered,
    mode: modes || "skipped",
    channels: results,
    error: delivered
      ? undefined
      : results.map((r) => r.error).filter(Boolean).join("; ") || undefined,
    title,
    body,
  };

  recordDemoAlert({
    tenant_id: opts.tenantId,
    session_id: opts.sessionId,
    event: opts.event,
    score_final: opts.scoreFinal,
    answers,
    channels: results,
    mode: out.mode,
    delivered,
    title,
    body,
  });

  return out;
}

async function sendEmailChannel(opts: {
  secrets: PostgresSecretStore;
  tenantId: string;
  sessionId: string;
  configVersion: number;
  secretRef: string;
  event: string;
  scoreFinal: number | null;
  title: string;
  body: string;
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
      title: opts.title,
      body: opts.body,
    };
  }

  const adapter = createEmailAlertAdapter(auth);
  const mode = auth.credentials.host ? "smtp" : "console";
  const result = await withAdapterRetry((attempt) =>
    adapter.send(
      {
        channel: "email",
        event: opts.event,
        title: opts.title,
        body: opts.body,
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
    return {
      type: "email",
      delivered: false,
      mode,
      error: result.message,
      title: opts.title,
      body: opts.body,
    };
  }
  return {
    type: "email",
    delivered: true,
    mode,
    title: opts.title,
    body: opts.body,
  };
}

async function sendSlackChannel(opts: {
  secrets: PostgresSecretStore;
  tenantId: string;
  sessionId: string;
  configVersion: number;
  secretRef: string;
  event: string;
  scoreFinal: number | null;
  title: string;
  body: string;
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
      title: opts.title,
      body: opts.body,
    };
  }

  const adapter = createSlackAlertAdapter(auth);
  const mode = auth.credentials.webhook_url ? "webhook" : "console";
  const result = await withAdapterRetry((attempt) =>
    adapter.send(
      {
        channel: "slack",
        event: opts.event,
        title: opts.title,
        body: opts.body,
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
    return {
      type: "slack",
      delivered: false,
      mode,
      error: result.message,
      title: opts.title,
      body: opts.body,
    };
  }
  return {
    type: "slack",
    delivered: true,
    mode,
    title: opts.title,
    body: opts.body,
  };
}
