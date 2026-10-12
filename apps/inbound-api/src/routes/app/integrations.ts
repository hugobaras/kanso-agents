import {
  getAccountingAdapter,
  getCalendarAdapter,
  getCrmAdapter,
} from "@kanso/adapters";
import { parseInboundConfig, type InboundConfig } from "@kanso/config";
import {
  getPool,
  loadDraftConfig,
  loadPublishedConfig,
  PostgresSecretStore,
  publishConfig,
  saveDraftConfig,
} from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { masterKey } from "../../env.js";
import { body } from "../../http/body.js";
import { badRequest, HttpError, notFound } from "../../http/errors.js";
import type { AppEnv } from "../../http/types.js";

type Category = "crm" | "calendar" | "accounting";

type Connector = {
  id: string;
  name: string;
  category: Category;
  description: string;
  fields: Array<{ key: string; label: string; secret: boolean; placeholder?: string; help?: string }>;
  tier: "standard" | "all";
};

export const CONNECTORS: Connector[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    description: "Crée ou met à jour un contact HubSpot pour chaque demande qualifiée.",
    fields: [{ key: "access_token", label: "Jeton d'application privée", secret: true, placeholder: "pat-eu1-…" }],
    tier: "standard",
  },
  {
    id: "sellsy",
    name: "Sellsy CRM",
    category: "crm",
    description: "Ajoute les demandes qualifiées comme prospects dans Sellsy.",
    fields: [{ key: "access_token", label: "Jeton d'API", secret: true }],
    tier: "all",
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "calendar",
    description: "Récupère vos créneaux pour proposer un rendez-vous.",
    fields: [
      { key: "access_token", label: "Jeton personnel", secret: true },
      { key: "event_type_uri", label: "URI du type d'événement", secret: false, placeholder: "https://api.calendly.com/event_types/…" },
    ],
    tier: "standard",
  },
  {
    id: "google_calendar",
    name: "Google Agenda",
    category: "calendar",
    description: "Consulte vos disponibilités dans Google Agenda.",
    fields: [
      { key: "access_token", label: "Jeton d'accès", secret: true },
      { key: "calendar_id", label: "Identifiant d'agenda", secret: false, placeholder: "primary" },
    ],
    tier: "all",
  },
  {
    id: "pennylane",
    name: "Pennylane",
    category: "accounting",
    description: "Crée des brouillons de factures fournisseurs à partir des documents validés.",
    fields: [{ key: "api_key", label: "Clé d'API", secret: true }],
    tier: "standard",
  },
  {
    id: "sellsy_accounting",
    name: "Sellsy Comptabilité",
    category: "accounting",
    description: "Envoie les documents validés vers Sellsy.",
    fields: [{ key: "access_token", label: "Jeton d'API", secret: true }],
    tier: "all",
  },
];

const secretRefFor = (c: Connector) =>
  c.category === "accounting" ? `targets.${c.id === "sellsy_accounting" ? "sellsy" : c.id}` : `${c.category}.${c.id}`;

function planAllows(ws: ReturnType<typeof currentWorkspace>, c: Connector): boolean {
  const level = ws.entitlements.plan.integrations;
  if (level === "all") return true;
  if (level === "standard") return c.tier === "standard";
  return false;
}

async function updateInboundIntegration(
  tenantId: string,
  actor: string,
  category: "crm" | "calendar",
  value: { provider: string; secret_ref: string } | null,
) {
  const pool = getPool();
  const mutate = (cfg: InboundConfig): InboundConfig => {
    const integrations = { ...(cfg.integrations ?? {}) };
    if (value) integrations[category] = value;
    else delete integrations[category];
    return { ...cfg, integrations };
  };
  const draft = await loadDraftConfig(pool, tenantId, "inbound");
  if (draft) {
    await saveDraftConfig(pool, { tenantId, product: "inbound", config: mutate(parseInboundConfig(draft.config)), updatedBy: actor });
  }
  const published = await loadPublishedConfig(pool, tenantId, "inbound");
  if (published) {
    await publishConfig(pool, { tenantId, product: "inbound", config: mutate(parseInboundConfig(published.config)), publishedBy: actor });
  }
}

export function integrationsRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const pool = getPool();
    const store = new PostgresSecretStore(pool, masterKey());
    const [published, dead] = await Promise.all([
      loadPublishedConfig(pool, ws.tenantId, "inbound"),
      pool.query<{ provider: string; n: string }>(
        `select provider, count(*)::text as n from adapter_dead_letters
         where tenant_id = $1 and resolved_at is null group by provider`,
        [ws.tenantId],
      ),
    ]);
    const inbound = published ? parseInboundConfig(published.config) : null;
    const connectors = await Promise.all(
      CONNECTORS.map(async (conn) => {
        const connected = await store.exists(ws.tenantId, secretRefFor(conn));
        const active =
          conn.category === "accounting"
            ? connected
            : inbound?.integrations?.[conn.category]?.provider === conn.id && connected;
        return {
          ...conn,
          connected,
          active,
          allowed: planAllows(ws, conn),
          failures: Number(dead.rows.find((d) => d.provider === conn.id)?.n ?? 0),
        };
      }),
    );
    const requests = await pool.query(
      `select id, platform, title, status, created_at from custom_integration_requests
       where tenant_id = $1 order by created_at desc limit 20`,
      [ws.tenantId],
    );
    return c.json({ connectors, custom_requests: requests.rows, custom_allowed: ws.entitlements.plan.customRequests });
  });

  app.put("/:id", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const conn = CONNECTORS.find((x) => x.id === c.req.param("id"));
    if (!conn) throw notFound("connector_not_found");
    if (!planAllows(ws, conn)) throw new HttpError(402, "plan_upgrade_required", "Cette intégration n'est pas incluse dans votre offre.");
    const b = await body(c.req, z.object({ credentials: z.record(z.string().trim().max(2000)) }));
    const creds: Record<string, string> = {};
    for (const f of conn.fields) {
      const v = b.credentials[f.key];
      if (!v) throw badRequest("field_required", `Champ requis : ${f.label}`);
      creds[f.key] = v;
    }
    await new PostgresSecretStore(getPool(), masterKey()).put(ws.tenantId, secretRefFor(conn), creds);
    if (conn.category !== "accounting") {
      await updateInboundIntegration(ws.tenantId, actorLabel(c), conn.category, {
        provider: conn.id,
        secret_ref: secretRefFor(conn),
      });
    }
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "integration", decision: `${conn.id}_connected` });
    return c.json({ ok: true });
  });

  app.delete("/:id", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "admin");
    const conn = CONNECTORS.find((x) => x.id === c.req.param("id"));
    if (!conn) throw notFound("connector_not_found");
    await new PostgresSecretStore(getPool(), masterKey()).delete(ws.tenantId, secretRefFor(conn));
    if (conn.category !== "accounting") {
      await updateInboundIntegration(ws.tenantId, actorLabel(c), conn.category, null);
    }
    await audit(getPool(), { tenantId: ws.tenantId, actor: actorLabel(c), step: "integration", decision: `${conn.id}_disconnected` });
    return c.json({ ok: true });
  });

  /** Lightweight live check (no writes on the remote side where possible). */
  app.post("/:id/test", async (c) => {
    const ws = currentWorkspace(c);
    const conn = CONNECTORS.find((x) => x.id === c.req.param("id"));
    if (!conn) throw notFound("connector_not_found");
    const store = new PostgresSecretStore(getPool(), masterKey());
    let auth;
    try {
      auth = await store.resolve(ws.tenantId, conn.id, secretRefFor(conn));
    } catch {
      throw badRequest("not_connected", "Connectez d'abord cette intégration.");
    }
    const ctx = { tenantId: ws.tenantId, correlationId: `test:${Date.now()}`, configVersion: 0, attempt: 1 };
    let ok = false;
    let message = "";
    try {
      if (conn.category === "calendar") {
        const r = await getCalendarAdapter(conn.id, auth).listSlots(
          { from: new Date().toISOString(), to: new Date(Date.now() + 86_400_000).toISOString(), timezone: "Europe/Paris" },
          auth,
          ctx,
        );
        ok = r.status === "ok";
        message = r.status === "ok" ? `${r.data.slots.length} créneau(x) trouvés sur 24 h` : r.message;
      } else if (conn.category === "crm") {
        getCrmAdapter(conn.id, auth);
        ok = true;
        message = "Identifiants enregistrés. La synchronisation se fera à la prochaine demande qualifiée.";
      } else {
        getAccountingAdapter(conn.id, auth);
        ok = true;
        message = "Identifiants enregistrés. Les prochains documents validés seront envoyés.";
      }
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    return c.json({ ok, message });
  });

  app.post("/custom-requests", async (c) => {
    const ws = currentWorkspace(c);
    const b = await body(
      c.req,
      z.object({
        platform: z.string().trim().min(2).max(80),
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().min(10, "Décrivez votre besoin en quelques phrases.").max(3000),
      }),
    );
    const pool = getPool();
    const res = await pool.query<{ id: string }>(
      `insert into custom_integration_requests (tenant_id, user_id, platform, title, description)
       values ($1, $2, $3, $4, $5) returning id`,
      [ws.tenantId, currentUser(c).id, b.platform, b.title, b.description],
    );
    await audit(pool, { tenantId: ws.tenantId, actor: actorLabel(c), step: "custom_request", decision: "opened" });
    return c.json({ ok: true, id: res.rows[0]!.id }, 201);
  });

  return app;
}
