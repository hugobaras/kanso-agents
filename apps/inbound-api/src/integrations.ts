import type { InboundConfig } from "@kanso/config";
import {
  getCalendarAdapter,
  getCrmAdapter,
  withAdapterRetry,
} from "@kanso/adapters";
import {
  getPool,
  PostgresSecretStore,
} from "@kanso/tenancy";
import type { InboundSession } from "@kanso/inbound-engine";

/** Après alerte : CRM puis agenda best-effort (H-016). */
export async function syncInboundIntegrations(opts: {
  tenantId: string;
  sessionId: string;
  configVersion: number;
  config: InboundConfig;
  session: InboundSession;
}): Promise<{
  crm?: { ok: boolean; recordId?: string; error?: string };
  calendar?: { ok: boolean; error?: string };
}> {
  const out: {
    crm?: { ok: boolean; recordId?: string; error?: string };
    calendar?: { ok: boolean; error?: string };
  } = {};

  const masterKey = process.env.KANSO_MASTER_KEY;
  if (!masterKey) return out;

  const pool = getPool();
  const secrets = new PostgresSecretStore(pool, masterKey);
  const crmCfg = opts.config.integrations?.crm;
  if (crmCfg) {
    try {
      const auth = await secrets.resolve(
        opts.tenantId,
        crmCfg.provider,
        crmCfg.secret_ref,
      );
      const adapter = getCrmAdapter(crmCfg.provider, auth);
      const email = String(
        opts.session.answers.contact_email ??
          opts.session.answers.email ??
          "",
      );
      const result = await withAdapterRetry((attempt) =>
        adapter.upsertLead(
          {
            externalKey: opts.sessionId,
            contact: { email: email || undefined },
            scoreFinal: opts.session.scoreFinal ?? undefined,
            answers: opts.session.answers,
            source: "kanso_inbound",
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
      out.crm =
        result.status === "ok"
          ? { ok: true, recordId: result.data.recordId }
          : { ok: false, error: result.message };
    } catch (err) {
      out.crm = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const calCfg = opts.config.integrations?.calendar;
  if (calCfg) {
    try {
      const auth = await secrets.resolve(
        opts.tenantId,
        calCfg.provider,
        calCfg.secret_ref,
      );
      const adapter = getCalendarAdapter(calCfg.provider, auth);
      // Best-effort: list slots only (booking = parcours ultérieur / UI)
      const result = await withAdapterRetry((attempt) =>
        adapter.listSlots(
          {
            from: new Date().toISOString(),
            to: new Date(Date.now() + 7 * 86400_000).toISOString(),
            timezone: opts.config.operations.timezone,
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
      out.calendar =
        result.status === "ok"
          ? { ok: true }
          : { ok: false, error: result.message };
    } catch (err) {
      out.calendar = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return out;
}
