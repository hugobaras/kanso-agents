import type { InboundConfig } from "@kanso/config";
import {
  createEmailAlertAdapter,
  createSlackAlertAdapter,
  withAdapterRetry,
} from "@kanso/adapters";
import { templates } from "@kanso/mailer";
import { getPool, PostgresSecretStore, type AuthContext } from "@kanso/tenancy";
import { extractContact, labelledAnswers, type LeadTier } from "./services/leads.js";
import { appLink, deliver } from "./services/mail.js";
import { createNotification } from "./services/notifications.js";

export type ChannelDelivery = {
  type: "email" | "slack";
  delivered: boolean;
  mode: "platform" | "smtp" | "console" | "webhook" | "skipped";
  error?: string;
};

const EVENT_TITLE: Record<string, string> = {
  hot_lead: "Demande prioritaire",
  handoff: "Nouvelle demande qualifiée",
  new_lead: "Nouvelle demande",
  escalation: "Demande de contact humain",
};

export async function dispatchInboundAlert(opts: {
  tenantId: string;
  sessionId: string;
  leadId: string;
  tier: LeadTier;
  configVersion: number;
  config: InboundConfig;
  event: string;
  scoreFinal: number;
  answers?: Record<string, unknown>;
}): Promise<{ delivered: boolean; channels: ChannelDelivery[] }> {
  const answers = opts.answers ?? {};
  const contact = extractContact(answers);
  const rows = labelledAnswers(opts.config, answers);
  const leadPath = `/app/${opts.tenantId}/demandes/${opts.leadId}`;
  const title = `${EVENT_TITLE[opts.event] ?? "Nouvelle demande"} — ${contact.name ?? contact.email ?? "visiteur"}`;

  await createNotification({
    tenantId: opts.tenantId,
    type: `lead:${opts.event}`,
    title,
    body: `Score ${opts.scoreFinal}/100`,
    link: leadPath,
  });

  const channels = opts.config.alerts.channels.filter(
    (c) => c.enabled !== false && (c.on as string[]).includes(opts.event),
  );
  const masterKey = process.env.KANSO_MASTER_KEY;
  if (channels.length === 0 || !masterKey) {
    return { delivered: false, channels: [] };
  }

  const secrets = new PostgresSecretStore(getPool(), masterKey);
  const results: ChannelDelivery[] = [];
  const textBody = [
    title,
    `Score : ${opts.scoreFinal} / 100`,
    ...rows.map(([k, v]) => `${k} : ${v}`),
    appLink(leadPath),
  ].join("\n");

  for (const channel of channels) {
    let auth: AuthContext;
    try {
      auth = await secrets.resolve(opts.tenantId, channel.type, channel.secret_ref);
    } catch (err) {
      results.push({
        type: channel.type,
        delivered: false,
        mode: "skipped",
        error: err instanceof Error ? err.message : "secret_resolve_failed",
      });
      continue;
    }
    if (channel.type === "email") {
      results.push(await sendEmail(opts, auth, rows, leadPath, textBody, title));
    } else {
      results.push(await sendSlack(opts, auth, textBody, title));
    }
  }
  return { delivered: results.some((r) => r.delivered), channels: results };
}

async function sendEmail(
  opts: Parameters<typeof dispatchInboundAlert>[0],
  auth: AuthContext,
  rows: Array<[string, string]>,
  leadPath: string,
  textBody: string,
  title: string,
): Promise<ChannelDelivery> {
  // Legacy pilotes: tenant-specific SMTP stored in the secret.
  if (auth.credentials.host) {
    const result = await withAdapterRetry((attempt) =>
      createEmailAlertAdapter(auth).send(
        { channel: "email", event: opts.event, title, body: textBody, metadata: { score: opts.scoreFinal } },
        auth,
        { tenantId: opts.tenantId, correlationId: opts.sessionId, configVersion: opts.configVersion, attempt },
      ),
    );
    return result.status === "ok"
      ? { type: "email", delivered: true, mode: "smtp" }
      : { type: "email", delivered: false, mode: "smtp", error: result.message };
  }
  const recipients = (auth.credentials.to ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
  if (recipients.length === 0) {
    return { type: "email", delivered: false, mode: "skipped", error: "no_recipient" };
  }
  const email = templates.newLead({
    workspace: opts.config.identity.display_name,
    tier: opts.tier,
    score: opts.scoreFinal,
    event: opts.event,
    rows,
    url: appLink(leadPath),
  });
  let ok = true;
  for (const to of recipients) ok = (await deliver(to, email)) && ok;
  return { type: "email", delivered: ok, mode: "platform" };
}

async function sendSlack(
  opts: Parameters<typeof dispatchInboundAlert>[0],
  auth: AuthContext,
  textBody: string,
  title: string,
): Promise<ChannelDelivery> {
  const mode = auth.credentials.webhook_url ? "webhook" : "console";
  const result = await withAdapterRetry((attempt) =>
    createSlackAlertAdapter(auth).send(
      { channel: "slack", event: opts.event, title, body: textBody, metadata: { score: opts.scoreFinal } },
      auth,
      { tenantId: opts.tenantId, correlationId: opts.sessionId, configVersion: opts.configVersion, attempt },
    ),
  );
  return result.status === "ok"
    ? { type: "slack", delivered: true, mode }
    : { type: "slack", delivered: false, mode, error: result.message };
}
