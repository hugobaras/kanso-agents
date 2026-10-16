import { randomBytes } from "node:crypto";
import { getPool } from "@kanso/tenancy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const hasDb = !!process.env.DATABASE_URL;
const APP = "http://localhost:3001";
const PORTAIL = "https://portail.example.test";

process.env.KANSO_APP_URL = APP;
process.env.KANSO_PORTAIL_URL = PORTAIL;
process.env.KANSO_MASTER_KEY ??= "test-master-key-at-least-32-characters!!";
process.env.KANSO_ACCESS_LOG = "0";
process.env.KANSO_AUTH_RATE_LIMIT = "1000";

const app = createApp({});
const suffix = randomBytes(4).toString("hex");

type Jar = Record<string, string>;
async function call(jar: Jar, method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      origin: APP,
      cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
    },
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

const signup = (jar: Jar, email: string, product?: "portail") =>
  call(jar, "POST", "/api/auth/signup", {
    name: "Test User",
    email,
    password: "un-mot-de-passe-1",
    workspace_name: `Cab ${email.split("@")[0]}`,
    profession: "avocat",
    accept_terms: true,
    ...(product ? { product } : {}),
  });

describe.skipIf(!hasDb)("Kanso Portail autonome", () => {
  const pro: Jar = {};
  const ass: Jar = {};
  const proEmail = `portail-${suffix}@example.com`;
  const assEmail = `assistant-${suffix}@example.com`;
  let wsP = "";
  let wsA = "";

  beforeAll(async () => {
    const p = await signup(pro, proEmail, "portail");
    expect(p.status).toBe(201);
    wsP = p.json.workspace;
    const a = await signup(ass, assEmail);
    expect(a.status).toBe(201);
    wsA = a.json.workspace;
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query(`delete from tenants where tenant_id = any($1)`, [[wsP, wsA]]);
    await pool.query(`delete from users where email like $1`, [`%-${suffix}@example.com`]);
  });

  it("opens a Portail-only workspace: portail on, Assistant modules off", async () => {
    const o = await call(pro, "GET", `/api/app/${wsP}`);
    expect(o.status).toBe(200);
    expect(o.json.entitlements.product).toBe("portail");
    expect(o.json.entitlements.plan).toBe("portail_trial");
    expect(o.json.entitlements.status).toBe("trialing");
    expect(o.json.entitlements.modules).toEqual({ inbound: false, document_to_action: false, portail: true });
    expect((await call(pro, "GET", `/api/app/${wsP}/portail`)).status).toBe(200);
  });

  it("refuses the Assistant routes to a Portail-only workspace", async () => {
    for (const path of ["/leads", "/assistant", "/documents"]) {
      const r = await call(pro, "GET", `/api/app/${wsP}${path}`);
      expect(r.status, path).toBe(403);
      expect(r.json.error).toBe("module_not_in_plan");
    }
  });

  it("keeps the Assistant signup unchanged: Portail stays closed", async () => {
    const o = await call(ass, "GET", `/api/app/${wsA}`);
    expect(o.json.entitlements.product).toBe("assistant");
    expect(o.json.entitlements.modules.portail).toBe(false);
    expect((await call(ass, "GET", `/api/app/${wsA}/portail`)).status).toBe(403);
  });

  it("e-mails confirmation and recovery links on the Portail domain", async () => {
    const mail = async (to: string, template: string) =>
      (
        await getPool().query<{ text_body: string }>(
          `select text_body from mail_outbox where to_email = $1 and template = $2 order by id desc limit 1`,
          [to, template],
        )
      ).rows[0]!.text_body;
    expect(await mail(proEmail, "verify_email")).toContain(`${PORTAIL}/verifier-email`);
    expect(await mail(assEmail, "verify_email")).toContain(`${APP}/verifier-email`);
    await call({}, "POST", "/api/auth/password/forgot", { email: proEmail });
    expect(await mail(proEmail, "password_reset")).toContain(`${PORTAIL}/mot-de-passe/nouveau`);
  });

  it("lists Portail plans only, and rejects a plan of the other product", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    try {
      const b = await call(pro, "GET", `/api/app/${wsP}/billing`);
      expect(b.json.plans.map((p: any) => p.id)).toEqual(["portail_essentiel", "portail_cabinet"]);
      expect(b.json.plans.map((p: any) => p.monthlyPriceCents)).toEqual([2900, 6900]);
      const bad = await call(pro, "POST", `/api/app/${wsP}/billing/checkout`, { plan: "cabinet", interval: "month" });
      expect(bad.status).toBe(409);
      expect(bad.json.error).toBe("plan_product_mismatch");
      const other = await call(ass, "POST", `/api/app/${wsA}/billing/checkout`, { plan: "portail_cabinet", interval: "month" });
      expect(other.status).toBe(409);
    } finally {
      delete process.env.STRIPE_SECRET_KEY;
    }
  });

  it("activates Portail Cabinet from a signed Stripe webhook", async () => {
    const Stripe = (await import("stripe")).default;
    const { setStripeClient } = await import("./services/stripe.js");
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const real = new Stripe("sk_test_dummy");
    const subscription = {
      id: `sub_p_${suffix}`,
      customer: `cus_p_${suffix}`,
      status: "active",
      cancel_at_period_end: false,
      metadata: { tenant_id: wsP },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { lookup_key: "kanso_portail_cabinet_month" } }] },
    };
    setStripeClient({ webhooks: real.webhooks, subscriptions: { retrieve: async () => subscription } } as unknown as InstanceType<typeof Stripe>);
    const event = {
      id: `evt_p_${suffix}`,
      object: "event",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test", object: "checkout.session", subscription: subscription.id, client_reference_id: wsP } },
    };
    const payload = JSON.stringify(event);
    const signature = real.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
    const r = await app.request("/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    });
    expect(r.status).toBe(200);

    const o = await call(pro, "GET", `/api/app/${wsP}`);
    expect(o.json.entitlements.plan).toBe("portail_cabinet");
    expect(o.json.entitlements.status).toBe("active");
    expect(o.json.entitlements.seats).toBe(10);
    expect(o.json.entitlements.modules.portail).toBe(true);
    expect(o.json.entitlements.modules.inbound).toBe(false);

    setStripeClient(null);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await getPool().query(`delete from stripe_events where event_id = $1`, [event.id]);
  });
});
