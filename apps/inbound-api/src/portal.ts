import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, PostgresSecretStore } from "@kanso/tenancy";
import type { Hono } from "hono";
import {
  auditPortal,
  consumeMagicLink,
  createMagicLink,
  createPortalSession,
  findPortalUsersByEmail,
  resolvePortalSession,
  revokePortalSession,
  type PortalUser,
} from "./portal-auth.js";
import {
  EMAIL_SECRET_REF,
  loadPublishedInbound,
  removeAlertChannel,
  republishInbound,
  setChannelEnabled,
  SLACK_SECRET_REF,
  upsertAlertChannel,
} from "./portal-config.js";

const here = dirname(fileURLToPath(import.meta.url));
const portalHtmlCandidates = [
  join(here, "../../inbound-widget/public/portal.html"),
  join(process.cwd(), "apps/inbound-widget/public/portal.html"),
];

function portalHtmlPath(): string | null {
  return portalHtmlCandidates.find((p) => existsSync(p)) ?? null;
}

function bearer(c: { req: { header: (n: string) => string | undefined } }) {
  const h = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim();
}

function requireMasterKey(): string {
  const k = process.env.KANSO_MASTER_KEY;
  if (!k) throw new Error("KANSO_MASTER_KEY required");
  return k;
}

function isProd(): boolean {
  return (process.env.KANSO_ENV ?? "local") === "production";
}

async function requireUser(
  c: { req: { header: (n: string) => string | undefined }; json: (b: unknown, s?: number) => Response },
): Promise<PortalUser | Response> {
  const pool = getPool();
  const user = await resolvePortalSession(pool, bearer(c));
  if (!user) return c.json({ error: "unauthorized" }, 401);
  return user;
}

export function mountPortalRoutes(app: Hono) {
  app.get("/portal", (c) => {
    const path = portalHtmlPath();
    if (!path) return c.text("portal.html missing", 404);
    return c.html(readFileSync(path, "utf8"));
  });

  app.post("/portal/api/auth/request", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      email?: string;
      tenant_id?: string;
    };
    const email = body.email?.trim();
    if (!email || !email.includes("@")) {
      return c.json({ error: "email_required" }, 400);
    }
    const pool = getPool();
    let users = await findPortalUsersByEmail(pool, email);
    if (body.tenant_id) {
      users = users.filter((u) => u.tenant_id === body.tenant_id);
    }
    if (users.length === 0) {
      // Anti-enumeration
      return c.json({
        ok: true,
        message: "Si un compte existe, un lien a été envoyé.",
      });
    }
    if (users.length > 1) {
      return c.json(
        {
          error: "tenant_required",
          hint: "Plusieurs cabinets pour cet e-mail — précisez tenant_id",
          tenants: users.map((u) => u.tenant_id),
        },
        400,
      );
    }
    const user = users[0]!;
    const { rawToken, expiresAt } = await createMagicLink(pool, user.id);
    const base =
      process.env.KANSO_PUBLIC_URL?.replace(/\/$/, "") ??
      `http://127.0.0.1:${process.env.PORT ?? 3000}`;
    const magicLink = `${base}/portal#token=${encodeURIComponent(rawToken)}`;

    console.log(
      JSON.stringify({
        level: "info",
        event: "portal_magic_link",
        tenant_id: user.tenant_id,
        email: user.email,
        expires_at: expiresAt.toISOString(),
        ...(isProd() ? {} : { magic_link: magicLink }),
      }),
    );

    await auditPortal(pool, {
      tenantId: user.tenant_id,
      actor: user.email,
      step: "portal_auth",
      decision: "magic_link_issued",
    });

    return c.json({
      ok: true,
      message: "Si un compte existe, un lien a été envoyé.",
      ...(isProd() ? {} : { magic_link: magicLink, token: rawToken }),
    });
  });

  app.post("/portal/api/auth/consume", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: string };
    if (!body.token) return c.json({ error: "token_required" }, 400);
    const pool = getPool();
    const user = await consumeMagicLink(pool, body.token);
    if (!user) return c.json({ error: "invalid_or_expired_token" }, 401);
    const session = await createPortalSession(pool, user.id);
    await auditPortal(pool, {
      tenantId: user.tenant_id,
      actor: user.email,
      step: "portal_auth",
      decision: "session_created",
    });
    return c.json({
      ok: true,
      session_token: session.rawToken,
      expires_at: session.expiresAt.toISOString(),
      user: {
        email: user.email,
        tenant_id: user.tenant_id,
        role: user.role,
      },
    });
  });

  app.post("/portal/api/auth/logout", async (c) => {
    const token = bearer(c);
    if (token) await revokePortalSession(getPool(), token);
    return c.json({ ok: true });
  });

  app.get("/portal/api/me", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const pool = getPool();
    const t = await pool.query<{ display_name: string }>(
      `select display_name from tenants where tenant_id = $1`,
      [userOr.tenant_id],
    );
    return c.json({
      ok: true,
      user: {
        email: userOr.email,
        tenant_id: userOr.tenant_id,
        role: userOr.role,
        display_name: t.rows[0]?.display_name ?? userOr.tenant_id,
      },
    });
  });

  app.get("/portal/api/connectors", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const pool = getPool();
    const published = await loadPublishedInbound(pool, userOr.tenant_id);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }
    const store = new PostgresSecretStore(pool, requireMasterKey());
    const emailCh = published.config.alerts.channels.find(
      (ch) => ch.type === "email",
    );
    const slackCh = published.config.alerts.channels.find(
      (ch) => ch.type === "slack",
    );
    const emailHints = await store.peekHints(
      userOr.tenant_id,
      EMAIL_SECRET_REF,
    );
    const slackHints = await store.peekHints(
      userOr.tenant_id,
      SLACK_SECRET_REF,
    );
    const emailConnected = !!emailHints;
    const slackConnected = !!slackHints;

    return c.json({
      ok: true,
      connectors: [
        {
          type: "email",
          label: "E-mail",
          connected: emailConnected,
          enabled: emailCh ? emailCh.enabled !== false : false,
          secret_ref: EMAIL_SECRET_REF,
          hints: emailHints,
          on: emailCh?.on ?? ["hot_lead", "escalation", "handoff"],
        },
        {
          type: "slack",
          label: "Slack",
          connected: slackConnected,
          enabled: slackCh ? slackCh.enabled !== false : false,
          secret_ref: SLACK_SECRET_REF,
          hints: slackHints
            ? { webhook_masked: slackHints.webhook_masked }
            : null,
          on: slackCh?.on ?? ["hot_lead", "escalation"],
        },
        {
          type: "custom",
          label: "Sur-mesure",
          connected: false,
          enabled: false,
          hint: "Teams, WhatsApp, autre — demande à l’équipe Kanso",
        },
      ],
    });
  });

  app.put("/portal/api/connectors/email", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const body = (await c.req.json().catch(() => ({}))) as {
      to?: string;
      from?: string;
      host?: string;
      port?: string;
      user?: string;
      pass?: string;
    };
    if (!body.to?.includes("@")) {
      return c.json({ error: "to_required" }, 400);
    }
    const pool = getPool();
    const published = await loadPublishedInbound(pool, userOr.tenant_id);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }
    const creds: Record<string, string> = {
      to: body.to.trim(),
      from: (body.from ?? body.to).trim(),
    };
    if (body.host) {
      creds.host = body.host;
      creds.port = body.port ?? "587";
      if (body.user) creds.user = body.user;
      if (body.pass) creds.pass = body.pass;
    }
    const store = new PostgresSecretStore(pool, requireMasterKey());
    await store.put(userOr.tenant_id, EMAIL_SECRET_REF, creds);
    const next = upsertAlertChannel(published.config, {
      type: "email",
      secret_ref: EMAIL_SECRET_REF,
      enabled: true,
    });
    const version = await republishInbound(
      pool,
      userOr.tenant_id,
      next,
      `portal:${userOr.email}`,
    );
    await auditPortal(pool, {
      tenantId: userOr.tenant_id,
      actor: userOr.email,
      step: "portal_connector",
      decision: "email_connected",
      summary: { version, to: creds.to, smtp: !!creds.host },
    });
    return c.json({ ok: true, type: "email", version });
  });

  app.delete("/portal/api/connectors/email", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const pool = getPool();
    const published = await loadPublishedInbound(pool, userOr.tenant_id);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }
    const store = new PostgresSecretStore(pool, requireMasterKey());
    await store.delete(userOr.tenant_id, EMAIL_SECRET_REF);
    const next = removeAlertChannel(published.config, "email");
    const version = await republishInbound(
      pool,
      userOr.tenant_id,
      next,
      `portal:${userOr.email}`,
    );
    await auditPortal(pool, {
      tenantId: userOr.tenant_id,
      actor: userOr.email,
      step: "portal_connector",
      decision: "email_revoked",
      summary: { version },
    });
    return c.json({ ok: true, type: "email", version });
  });

  app.put("/portal/api/connectors/slack", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const body = (await c.req.json().catch(() => ({}))) as {
      webhook_url?: string;
    };
    const url = body.webhook_url?.trim() ?? "";
    if (!url.startsWith("https://hooks.slack.com/")) {
      return c.json(
        { error: "invalid_webhook", hint: "URL https://hooks.slack.com/…" },
        400,
      );
    }
    const pool = getPool();
    const published = await loadPublishedInbound(pool, userOr.tenant_id);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }
    const store = new PostgresSecretStore(pool, requireMasterKey());
    await store.put(userOr.tenant_id, SLACK_SECRET_REF, {
      webhook_url: url,
    });
    const next = upsertAlertChannel(published.config, {
      type: "slack",
      secret_ref: SLACK_SECRET_REF,
      enabled: true,
    });
    const version = await republishInbound(
      pool,
      userOr.tenant_id,
      next,
      `portal:${userOr.email}`,
    );
    await auditPortal(pool, {
      tenantId: userOr.tenant_id,
      actor: userOr.email,
      step: "portal_connector",
      decision: "slack_connected",
      summary: { version },
    });
    return c.json({ ok: true, type: "slack", version });
  });

  app.delete("/portal/api/connectors/slack", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const pool = getPool();
    const published = await loadPublishedInbound(pool, userOr.tenant_id);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }
    const store = new PostgresSecretStore(pool, requireMasterKey());
    await store.delete(userOr.tenant_id, SLACK_SECRET_REF);
    const next = removeAlertChannel(published.config, "slack");
    const version = await republishInbound(
      pool,
      userOr.tenant_id,
      next,
      `portal:${userOr.email}`,
    );
    await auditPortal(pool, {
      tenantId: userOr.tenant_id,
      actor: userOr.email,
      step: "portal_connector",
      decision: "slack_revoked",
      summary: { version },
    });
    return c.json({ ok: true, type: "slack", version });
  });

  app.post("/portal/api/connectors/:type/enable", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const type = c.req.param("type");
    if (type !== "email" && type !== "slack") {
      return c.json({ error: "invalid_type" }, 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      enabled?: boolean;
    };
    if (typeof body.enabled !== "boolean") {
      return c.json({ error: "enabled_required" }, 400);
    }
    const pool = getPool();
    const published = await loadPublishedInbound(pool, userOr.tenant_id);
    if (!published) {
      return c.json({ error: "no_published_inbound_config" }, 404);
    }
    const has = published.config.alerts.channels.some((ch) => ch.type === type);
    if (!has) {
      return c.json({ error: "channel_not_configured" }, 400);
    }
    const next = setChannelEnabled(published.config, type, body.enabled);
    const version = await republishInbound(
      pool,
      userOr.tenant_id,
      next,
      `portal:${userOr.email}`,
    );
    await auditPortal(pool, {
      tenantId: userOr.tenant_id,
      actor: userOr.email,
      step: "portal_connector",
      decision: body.enabled ? `${type}_enabled` : `${type}_disabled`,
      summary: { version },
    });
    return c.json({ ok: true, type, enabled: body.enabled, version });
  });

  app.get("/portal/api/custom-requests", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const pool = getPool();
    const res = await pool.query(
      `select id, platform, title, description, status, created_at
       from custom_integration_requests
       where tenant_id = $1
       order by created_at desc limit 50`,
      [userOr.tenant_id],
    );
    return c.json({ ok: true, requests: res.rows });
  });

  app.post("/portal/api/custom-requests", async (c) => {
    const userOr = await requireUser(c);
    if (userOr instanceof Response) return userOr;
    const body = (await c.req.json().catch(() => ({}))) as {
      platform?: string;
      title?: string;
      description?: string;
    };
    const platform = body.platform?.trim() ?? "";
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    if (!platform || !title || description.length < 10) {
      return c.json(
        {
          error: "invalid_request",
          hint: "platform, title, description (≥10 car.) requis",
        },
        400,
      );
    }
    const pool = getPool();
    const res = await pool.query<{ id: string }>(
      `insert into custom_integration_requests
        (tenant_id, portal_user_id, platform, title, description)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [userOr.tenant_id, userOr.id, platform, title, description],
    );
    const id = res.rows[0]?.id;
    console.log(
      JSON.stringify({
        level: "info",
        event: "custom_integration_request",
        tenant_id: userOr.tenant_id,
        email: userOr.email,
        platform,
        title,
        request_id: id,
      }),
    );
    await auditPortal(pool, {
      tenantId: userOr.tenant_id,
      actor: userOr.email,
      step: "portal_custom",
      decision: "request_opened",
      summary: { id, platform, title },
    });
    return c.json({ ok: true, id, status: "open" }, 201);
  });
}
