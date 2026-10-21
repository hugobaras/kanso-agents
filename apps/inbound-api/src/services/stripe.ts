import Stripe from "stripe";
import {
  isPaidPlanId,
  lookupKey,
  parseLookupKey,
  PLANS,
  type BillingInterval,
  type PaidPlanId,
} from "@kanso/billing";
import { templates } from "@kanso/mailer";
import { getPool, type PoolClient, withTransaction } from "@kanso/tenancy";
import { deliver, productLink, tenantLink, workspaceAdminEmails } from "./mail.js";
import { createNotification } from "./notifications.js";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  client ??= new Stripe(key, { appInfo: { name: "Kanso" } });
  return client;
}

/** Test hook. */
export function setStripeClient(s: Stripe | null) {
  client = s;
}

async function priceIdFor(plan: PaidPlanId, interval: BillingInterval): Promise<string> {
  const key = lookupKey(plan, interval);
  const prices = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) throw new Error(`Stripe price not found for lookup_key ${key} — run scripts/stripe-seed.mts`);
  return price.id;
}

async function ensureCustomer(tenantId: string, email: string, name: string): Promise<string> {
  const pool = getPool();
  const existing = await pool.query<{ stripe_customer_id: string | null }>(
    `select stripe_customer_id from subscriptions where tenant_id = $1`,
    [tenantId],
  );
  const id = existing.rows[0]?.stripe_customer_id;
  if (id) return id;
  const customer = await stripe().customers.create(
    { email, name, metadata: { tenant_id: tenantId }, preferred_locales: ["fr"] },
    { idempotencyKey: `customer:${tenantId}` },
  );
  await pool.query(`update subscriptions set stripe_customer_id = $2, updated_at = now() where tenant_id = $1`, [
    tenantId,
    customer.id,
  ]);
  return customer.id;
}

export async function createCheckoutSession(opts: {
  tenantId: string;
  workspaceName: string;
  email: string;
  plan: PaidPlanId;
  interval: BillingInterval;
}): Promise<string> {
  const customer = await ensureCustomer(opts.tenantId, opts.email, opts.workspaceName);
  const price = await priceIdFor(opts.plan, opts.interval);
  const billing = `/app/${opts.tenantId}/facturation`;
  const product = PLANS[opts.plan].product;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: opts.tenantId,
    line_items: [{ price, quantity: 1 }],
    locale: "fr",
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "1" },
    subscription_data: { metadata: { tenant_id: opts.tenantId } },
    metadata: { tenant_id: opts.tenantId },
    success_url: productLink(product, `${billing}?checkout=success`),
    cancel_url: productLink(product, `${billing}?checkout=cancel`),
  });
  if (!session.url) throw new Error("Stripe checkout session without URL");
  return session.url;
}

export async function createPortalSession(tenantId: string): Promise<string> {
  const res = await getPool().query<{ stripe_customer_id: string | null }>(
    `select stripe_customer_id from subscriptions where tenant_id = $1`,
    [tenantId],
  );
  const customer = res.rows[0]?.stripe_customer_id;
  if (!customer) throw new Error("no_stripe_customer");
  const session = await stripe().billingPortal.sessions.create({
    customer,
    locale: "fr",
    return_url: await tenantLink(tenantId, `/app/${tenantId}/facturation`),
  });
  return session.url;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // API ≥ 2025-03 moved current_period_end onto subscription items.
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const ts = fromItem ?? legacy;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

const STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  canceled: "canceled",
  paused: "canceled",
};

/** Mirror a Stripe subscription onto our row (source of truth = Stripe). */
export async function syncSubscription(db: PoolClient, sub: Stripe.Subscription, tenantHint?: string): Promise<string | null> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const tenantId =
    tenantHint ??
    sub.metadata?.tenant_id ??
    (
      await db.query<{ tenant_id: string }>(`select tenant_id from subscriptions where stripe_customer_id = $1`, [customerId])
    ).rows[0]?.tenant_id;
  if (!tenantId) return null;
  const price = sub.items.data[0]?.price;
  const parsed = parseLookupKey(price?.lookup_key);
  const status = STATUS_MAP[sub.status] ?? "incomplete";
  if (status === "canceled") {
    await db.query(
      `update subscriptions set status = 'canceled', stripe_subscription_id = $2, cancel_at_period_end = false,
         current_period_end = $3, updated_at = now() where tenant_id = $1`,
      [tenantId, sub.id, periodEnd(sub)],
    );
    return tenantId;
  }
  if (!parsed || !isPaidPlanId(parsed.plan)) {
    console.warn(JSON.stringify({ level: "warn", event: "stripe_unknown_price", lookup_key: price?.lookup_key ?? null }));
    return tenantId;
  }
  await db.query(
    `insert into subscriptions (tenant_id, plan, status, billing_interval, stripe_customer_id, stripe_subscription_id,
                                current_period_end, cancel_at_period_end)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (tenant_id) do update set
       plan = excluded.plan, status = excluded.status, billing_interval = excluded.billing_interval,
       stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,
       current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end,
       trial_ends_at = null, updated_at = now()`,
    [tenantId, parsed.plan, status, parsed.interval, customerId, sub.id, periodEnd(sub), sub.cancel_at_period_end],
  );
  await db.query(
    `update tenants set status = 'active', suspended_reason = null
     where tenant_id = $1 and status = 'suspended' and suspended_reason in ('trial_expired', 'payment')`,
    [tenantId],
  );
  return tenantId;
}

/**
 * Process a verified Stripe event exactly once (stripe_events PK). The
 * subscription is always re-fetched so out-of-order deliveries converge.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  const pool = getPool();
  return withTransaction(pool, async (db) => {
    const inserted = await db.query(
      `insert into stripe_events (event_id, type) values ($1, $2) on conflict do nothing returning event_id`,
      [event.id, event.type],
    );
    if (inserted.rowCount === 0) return "duplicate";

    let outcome: "processed" | "ignored" = "processed";
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
        if (subId) {
          const sub = await stripe().subscriptions.retrieve(subId);
          await syncSubscription(db, sub, s.client_reference_id ?? undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const obj = event.data.object as Stripe.Subscription;
        const sub = event.type === "customer.subscription.deleted" ? obj : await stripe().subscriptions.retrieve(obj.id);
        await syncSubscription(db, sub);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        const t = await db.query<{ tenant_id: string; display_name: string }>(
          `select s.tenant_id, t.display_name from subscriptions s join tenants t on t.tenant_id = s.tenant_id
           where s.stripe_customer_id = $1`,
          [customerId],
        );
        const row = t.rows[0];
        if (row) {
          await db.query(`update subscriptions set status = 'past_due', updated_at = now() where tenant_id = $1`, [row.tenant_id]);
          // Side effects after commit would be ideal; mail failures never throw.
          setImmediate(() => void notifyPaymentFailed(row.tenant_id, row.display_name));
        }
        break;
      }
      default:
        outcome = "ignored";
    }
    await db.query(`update stripe_events set processed_at = now() where event_id = $1`, [event.id]);
    return outcome;
  });
}

async function notifyPaymentFailed(tenantId: string, name: string) {
  const link = `/app/${tenantId}/facturation`;
  await createNotification({ tenantId, type: "billing:payment_failed", title: "Échec du paiement", link });
  const email = templates.paymentFailed({ workspace: name, url: await tenantLink(tenantId, link) });
  for (const to of await workspaceAdminEmails(tenantId)) await deliver(to, email);
}
