import { randomBytes } from "node:crypto";
import { getPool } from "@kanso/tenancy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { base32Decode, currentStep, totpAt } from "./auth/totp.js";

const hasDb = !!process.env.DATABASE_URL;
const APP = "http://localhost:3001";
process.env.KANSO_APP_URL = APP;
process.env.KANSO_MASTER_KEY ??= "test-master-key-at-least-32-characters!!";
process.env.KANSO_ACCESS_LOG = "0";
process.env.KANSO_AUTH_RATE_LIMIT = "1000";

const app = createApp({});
const suffix = randomBytes(4).toString("hex");
const EMAIL = `mfa-${suffix}@example.com`;
const PASSWORD = "un-mot-de-passe-1";
type Jar = Record<string, string>;

async function call(jar: Jar, method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { "content-type": "application/json", origin: APP, cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [kv] = sc.split(";");
    const i = kv!.indexOf("=");
    jar[kv!.slice(0, i)] = kv!.slice(i + 1);
  }
  const text = await res.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json };
}
const codeFor = (secret: string, offset = 0) => totpAt(base32Decode(secret), currentStep() + offset);
const mail = async (template: string) =>
  (await getPool().query<{ text_body: string }>(`select text_body from mail_outbox where to_email = $1 and template = $2 order by id desc limit 1`, [EMAIL, template])).rows[0]!.text_body;

describe.skipIf(!hasDb)("Double authentification", () => {
  let ws = "";
  let secret = "";
  let recovery: string[] = [];

  beforeAll(async () => {
    const jar: Jar = {};
    const r = await call(jar, "POST", "/api/auth/signup", { name: "Test", email: EMAIL, password: PASSWORD, workspace_name: `MFA ${suffix}`, profession: "avocat", accept_terms: true });
    ws = r.json.workspace;
    const setup = await call(jar, "POST", "/api/auth/mfa/setup");
    expect(setup.json.otpauth_url).toContain("otpauth://totp/");
    secret = setup.json.secret;
    expect((await call(jar, "POST", "/api/auth/mfa/enable", { code: "000000" })).status).toBe(400);
    const en = await call(jar, "POST", "/api/auth/mfa/enable", { code: codeFor(secret) });
    expect(en.status).toBe(200);
    recovery = en.json.recovery_codes;
    expect(recovery).toHaveLength(10);
    const stored = await getPool().query(`select totp_secret_enc from users where email = $1`, [EMAIL]);
    expect(stored.rows[0].totp_secret_enc).not.toContain(secret);
  });

  afterAll(async () => {
    await getPool().query(`delete from tenants where tenant_id = $1`, [ws]);
    await getPool().query(`delete from users where email like $1`, [`%-${suffix}@example.com`]);
  });

  it("asks for the code after the password and opens no session before it", async () => {
    const jar: Jar = {};
    const r = await call(jar, "POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
    expect(r.json).toMatchObject({ mfa_required: true });
    expect(jar.kanso_session).toBeUndefined();
    expect((await call(jar, "GET", "/api/auth/me")).status).toBe(401);
    expect((await call(jar, "POST", "/api/auth/login/mfa", { mfa_token: r.json.mfa_token, code: "123456" })).status).toBe(401);
    // The code used at enable time is a replay; the next step is accepted.
    const ok = await call(jar, "POST", "/api/auth/login/mfa", { mfa_token: r.json.mfa_token, code: codeFor(secret, 1) });
    expect(ok.status).toBe(200);
    expect((await call(jar, "GET", "/api/auth/me")).json.user.mfa_enabled).toBe(true);
    // The challenge is single-use.
    expect((await call({}, "POST", "/api/auth/login/mfa", { mfa_token: r.json.mfa_token, code: recovery[9] })).status).toBe(401);
  });

  it("refuses a replayed code and accepts each recovery code once", async () => {
    const a = await call({}, "POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
    expect((await call({}, "POST", "/api/auth/login/mfa", { mfa_token: a.json.mfa_token, code: codeFor(secret, 1) })).status).toBe(401);
    const jar: Jar = {};
    expect((await call(jar, "POST", "/api/auth/login/mfa", { mfa_token: a.json.mfa_token, code: recovery[0]!.toUpperCase() })).status).toBe(200);
    const b = await call({}, "POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
    expect((await call({}, "POST", "/api/auth/login/mfa", { mfa_token: b.json.mfa_token, code: recovery[0] })).status).toBe(401);
    expect((await call(jar, "GET", "/api/auth/mfa")).json.recovery_codes_left).toBe(9);
  });

  it("applies to e-mail links and password resets too", async () => {
    await call({}, "POST", "/api/auth/magic-link", { email: EMAIL });
    const magic = /token=([A-Za-z0-9_-]+)/.exec(await mail("magic_link"))![1];
    const jar: Jar = {};
    expect((await call(jar, "POST", "/api/auth/magic-link/consume", { token: magic })).json).toMatchObject({ mfa_required: true });
    expect(jar.kanso_session).toBeUndefined();

    await call({}, "POST", "/api/auth/password/forgot", { email: EMAIL });
    const reset = /token=([A-Za-z0-9_-]+)/.exec(await mail("password_reset"))![1];
    const jar2: Jar = {};
    expect((await call(jar2, "POST", "/api/auth/password/reset", { token: reset, password: PASSWORD })).json).toMatchObject({ mfa_required: true });
    expect(jar2.kanso_session).toBeUndefined();
  });

  it("closes the back-office to staff without two-factor in production", async () => {
    const staff: Jar = {};
    const r = await call(staff, "POST", "/api/auth/signup", { name: "Staff", email: `staff-${suffix}@example.com`, password: PASSWORD, workspace_name: `Staff ${suffix}`, profession: "avocat", accept_terms: true });
    await getPool().query(`update users set is_staff = true where email = $1`, [`staff-${suffix}@example.com`]);
    const prev = process.env.KANSO_ENV;
    process.env.KANSO_ENV = "production";
    try {
      const res = await app.request("/api/admin/stats", { headers: { origin: APP, cookie: `kanso_session=${staff.kanso_session}` } });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe("mfa_required");
    } finally {
      process.env.KANSO_ENV = prev;
    }
    expect((await call(staff, "GET", "/api/admin/stats")).status).toBe(200);
    await getPool().query(`delete from tenants where tenant_id = $1`, [r.json.workspace]);
  });
});
