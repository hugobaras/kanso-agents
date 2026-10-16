/**
 * Creates (or verifies) the Kanso products and prices in Stripe.
 * Idempotent: prices are found by lookup_key (kanso_<plan>_<interval>).
 *
 *   STRIPE_SECRET_KEY=sk_test_… pnpm --filter @kanso/inbound-api stripe:seed
 */
import Stripe from "stripe";
import { lookupKey, ALL_PAID_PLANS, PLANS, type BillingInterval } from "@kanso/billing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}
if (key.startsWith("sk_live_") && process.env.KANSO_STRIPE_ALLOW_LIVE !== "1") {
  console.error("Refusing to seed a live account without KANSO_STRIPE_ALLOW_LIVE=1");
  process.exit(1);
}
const stripe = new Stripe(key);

async function ensureProduct(planId: (typeof ALL_PAID_PLANS)[number]): Promise<string> {
  const plan = PLANS[planId];
  const found = await stripe.products.search({ query: `metadata['kanso_plan']:'${planId}'` });
  if (found.data[0]) return found.data[0].id;
  const product = await stripe.products.create({
    name: `Kanso ${plan.name}`,
    description: plan.tagline,
    metadata: { kanso_plan: planId },
    tax_code: "txcd_10103001", // SaaS — business use
  });
  return product.id;
}

async function ensurePrice(planId: (typeof ALL_PAID_PLANS)[number], productId: string, interval: BillingInterval) {
  const lk = lookupKey(planId, interval);
  const existing = await stripe.prices.list({ lookup_keys: [lk], limit: 1 });
  const amount = interval === "year" ? PLANS[planId].yearlyPriceCents : PLANS[planId].monthlyPriceCents;
  if (existing.data[0]) {
    if (existing.data[0].unit_amount !== amount) {
      console.warn(`⚠ ${lk}: Stripe price ${existing.data[0].unit_amount} ≠ catalogue ${amount}. Create a new price and transfer the lookup_key manually.`);
    }
    return existing.data[0].id;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: amount,
    recurring: { interval },
    tax_behavior: "exclusive",
    lookup_key: lk,
    metadata: { kanso_plan: planId, interval },
  });
  return price.id;
}

for (const planId of ALL_PAID_PLANS) {
  const productId = await ensureProduct(planId);
  for (const interval of ["month", "year"] as const) {
    const priceId = await ensurePrice(planId, productId, interval);
    console.log(`${lookupKey(planId, interval).padEnd(24)} ${priceId}`);
  }
}
console.log("\nNext: configure the Customer Portal (plan switching, cancellation) and a webhook to /api/stripe/webhook");
console.log("Events: checkout.session.completed, customer.subscription.created|updated|deleted, invoice.payment_failed");
