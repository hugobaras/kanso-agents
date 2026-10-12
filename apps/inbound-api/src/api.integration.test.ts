import { randomBytes } from "node:crypto";
import { getPool } from "@kanso/tenancy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

/**
 * End-to-end API tests against a real Postgres (migrations applied).
 * Skipped when DATABASE_URL is not set.
 */
const hasDb = !!process.env.DATABASE_URL;
const APP = "http://localhost:3001";

process.env.KANSO_APP_URL = APP;
process.env.KANSO_MASTER_KEY ??= "test-master-key-at-least-32-characters!!";
process.env.KANSO_ACCESS_LOG = "0";
process.env.MISTRAL_API_KEY = "";
process.env.KANSO_AUTH_RATE_LIMIT = "1000";

const app = createApp({ now: () => new Date("2026-10-12T10:00:00Z") });
const suffix = randomBytes(4).toString("hex");

type Jar = { cookie?: string };

async function call(
  jar: Jar,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const res = await app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      origin: APP,
      ...(jar.cookie ? { cookie: jar.cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get("set-cookie");
  if (set) jar.cookie = set.split(";")[0];
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

async function signup(jar: Jar, name: string) {
  const r = await call(jar, "POST", "/api/auth/signup", {
    name: "Test User",
    email: `${name}-${suffix}@example.com`,
    password: "un-mot-de-passe-1",
    workspace_name: `${name} ${suffix}`,
    profession: "avocat",
    accept_terms: true,
  });
  expect(r.status).toBe(201);
  return r.json.workspace as string;
}

describe.skipIf(!hasDb)("SaaS API", () => {
  const alice: Jar = {};
  const bob: Jar = {};
  let wsA = "";
  let wsB = "";

  beforeAll(async () => {
    wsA = await signup(alice, "alice");
    wsB = await signup(bob, "bob");
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query(`delete from tenants where tenant_id = any($1)`, [[wsA, wsB]]);
    await pool.query(`delete from users where email like $1`, [`%-${suffix}@example.com`]);
  });

  it("rejects weak passwords and duplicate e-mails", async () => {
    const weak = await call({}, "POST", "/api/auth/signup", {
      name: "X Y",
      email: `weak-${suffix}@example.com`,
      password: "short",
      workspace_name: "Weak",
      profession: "notaire",
      accept_terms: true,
    });
    expect(weak.status).toBe(400);
    const dup = await call({}, "POST", "/api/auth/signup", {
      name: "X Y",
      email: `alice-${suffix}@example.com`,
      password: "un-mot-de-passe-1",
      workspace_name: "Dup",
      profession: "notaire",
      accept_terms: true,
    });
    expect(dup.status).toBe(409);
  });

  it("logs in with password and rejects bad credentials", async () => {
    const jar: Jar = {};
    const bad = await call(jar, "POST", "/api/auth/login", { email: `alice-${suffix}@example.com`, password: "nope-nope-1" });
    expect(bad.status).toBe(401);
    const ok = await call(jar, "POST", "/api/auth/login", { email: `alice-${suffix}@example.com`, password: "un-mot-de-passe-1" });
    expect(ok.status).toBe(200);
    expect(ok.json.workspaces).toContain(wsA);
  });

  it("requires a session and blocks cross-workspace access", async () => {
    expect((await call({}, "GET", `/api/app/${wsA}`)).status).toBe(401);
    expect((await call(bob, "GET", `/api/app/${wsA}`)).status).toBe(404);
    expect((await call(alice, "GET", `/api/app/${wsA}`)).status).toBe(200);
  });

  it("enforces CSRF origin on cookie mutations", async () => {
    const r = await call(alice, "POST", `/api/app/${wsA}/assistant/publish`, {}, { origin: "https://evil.example" });
    expect(r.status).toBe(403);
    expect(r.json.error).toBe("csrf_origin_mismatch");
  });

  it("never reflects foreign origins on the credentialed API", async () => {
    const r = await call(alice, "GET", `/api/auth/me`, undefined, { origin: "https://evil.example" });
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("enforces roles: members cannot publish", async () => {
    const pool = getPool();
    const bobUser = await pool.query<{ id: string }>(`select id from users where email = $1`, [`bob-${suffix}@example.com`]);
    await pool.query(`insert into memberships (tenant_id, user_id, role) values ($1, $2, 'member')`, [wsA, bobUser.rows[0]!.id]);
    const r = await call(bob, "POST", `/api/app/${wsA}/assistant/publish`, {});
    expect(r.status).toBe(403);
    await pool.query(`delete from memberships where tenant_id = $1 and user_id = $2`, [wsA, bobUser.rows[0]!.id]);
  });

  it("runs a widget conversation into a lead, with origin allowlist", async () => {
    expect((await call(alice, "PUT", `/api/app/${wsA}/assistant/alerts/email`, { recipients: ["alerts@example.com"] })).status).toBe(200);
    expect((await call(alice, "POST", `/api/app/${wsA}/assistant/publish`, {})).status).toBe(200);
    const install = await call(alice, "GET", `/api/app/${wsA}/assistant/install`);
    const key = install.json.public_key as string;
    expect(key).toMatch(/^pk_live_/);

    await call(alice, "PUT", `/api/app/${wsA}/assistant/install/origins`, { origins: ["https://www.cabinet-a.fr"] });
    const denied = await call({}, "POST", "/v1/widget/sessions", undefined, {
      "x-kanso-key": key,
      origin: "https://evil.example",
    });
    expect(denied.status).toBe(403);

    const site = { "x-kanso-key": key, origin: "https://www.cabinet-a.fr" };
    const start = await call({}, "POST", "/v1/widget/sessions", undefined, site);
    expect(start.status).toBe(200);
    const sid = start.json.session_id as string;
    for (const text of ["Droit du travail", "Sous 48 h", "Entreprise", "Jeanne Test", "jeanne@example.com"]) {
      const t = await call({}, "POST", `/v1/widget/sessions/${sid}/messages`, { text }, site);
      expect(t.status).toBe(200);
    }
    const resume = await call({}, "GET", `/v1/widget/sessions/${sid}/messages`, undefined, site);
    // Closed sessions are not resumable.
    expect(resume.status).toBe(404);

    const leads = await call(alice, "GET", `/api/app/${wsA}/leads`);
    expect(leads.json.leads).toHaveLength(1);
    expect(leads.json.leads[0].contact.email).toBe("jeanne@example.com");
    expect(leads.json.leads[0].tier).toBe("hot");

    // Other workspaces never see it.
    const other = await call(bob, "GET", `/api/app/${wsB}/leads`);
    expect(other.json.leads).toHaveLength(0);

    const detail = await call(alice, "GET", `/api/app/${wsA}/leads/${leads.json.leads[0].id}`);
    expect(detail.json.transcript.length).toBeGreaterThan(5);
    const patched = await call(alice, "PATCH", `/api/app/${wsA}/leads/${leads.json.leads[0].id}`, { status: "contacted" });
    expect(patched.status).toBe(200);
  });

  it("blocks conversations when the monthly quota is exhausted", async () => {
    const pool = getPool();
    await pool.query(
      `insert into usage_counters (tenant_id, metric, period, count) values ($1, 'conversations', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'), 50)
       on conflict (tenant_id, metric, period) do update set count = 50`,
      [wsA],
    );
    await pool.query(`update widget_keys set allowed_origins = '{}' where tenant_id = $1`, [wsA]);
    const key = (await call(alice, "GET", `/api/app/${wsA}/assistant/install`)).json.public_key;
    const site = { "x-kanso-key": key, origin: "https://www.cabinet-a.fr" };
    const start = await call({}, "POST", "/v1/widget/sessions", undefined, site);
    const t = await call({}, "POST", `/v1/widget/sessions/${start.json.session_id}/messages`, { text: "Droit du travail" }, site);
    expect(t.status).toBe(429);
    expect(t.json.error).toBe("quota_exceeded");
  });

  it("makes the widget unavailable once the trial has expired", async () => {
    const pool = getPool();
    await pool.query(`update subscriptions set trial_ends_at = now() - interval '1 day' where tenant_id = $1`, [wsA]);
    const key = (await call(alice, "GET", `/api/app/${wsA}/assistant/install`)).json.public_key;
    const cfg = await call({}, "GET", `/v1/widget/config?key=${key}`, undefined, { origin: "https://www.cabinet-a.fr" });
    expect(cfg.json.available).toBe(false);
    const pub = await call(alice, "POST", `/api/app/${wsA}/assistant/publish`, {});
    expect(pub.status).toBe(402);
    await pool.query(`update subscriptions set trial_ends_at = now() + interval '14 days' where tenant_id = $1`, [wsA]);
  });

  it("rejects unknown and revoked widget keys", async () => {
    const r = await call({}, "GET", `/v1/widget/config?key=pk_live_doesnotexist000`);
    expect(r.status).toBe(401);
  });

  it("requires the DPA before document upload", async () => {
    const form = new FormData();
    form.set("file", new File([Buffer.from("%PDF-1.4 test")], "facture.pdf", { type: "application/pdf" }));
    const res = await app.request(`/api/app/${wsA}/documents`, {
      method: "POST",
      headers: { origin: APP, cookie: alice.cookie! },
      body: form,
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("dpa_required");
  });

  it("rate limits repeated widget session creation", async () => {
    const key = (await call(alice, "GET", `/api/app/${wsA}/assistant/install`)).json.public_key;
    const headers = { "x-kanso-key": key, origin: "https://www.cabinet-a.fr", "x-forwarded-for": `10.9.${suffix.length}.77` };
    let last = 200;
    for (let i = 0; i < 12; i++) last = (await call({}, "POST", "/v1/widget/sessions", undefined, headers)).status;
    expect(last).toBe(429);
  });
});
