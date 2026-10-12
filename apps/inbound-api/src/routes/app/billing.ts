import { PAID_PLANS, PLANS, readAllUsage } from "@kanso/billing";
import { getPool } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { assertRole, currentUser, currentWorkspace } from "../../auth/middleware.js";
import { body } from "../../http/body.js";
import { HttpError } from "../../http/errors.js";
import type { AppEnv } from "../../http/types.js";
import { createCheckoutSession, createPortalSession, stripeConfigured } from "../../services/stripe.js";
import { serializeEntitlements } from "./overview.js";

export function billingRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const pool = getPool();
    const [usage, members] = await Promise.all([
      readAllUsage(pool, ws.tenantId),
      pool.query<{ n: string }>(`select count(*)::text as n from memberships where tenant_id = $1`, [ws.tenantId]),
    ]);
    return c.json({
      entitlements: serializeEntitlements(ws.entitlements),
      usage: { ...usage, seats: Number(members.rows[0]?.n ?? 0) },
      plans: PAID_PLANS.map((id) => PLANS[id]),
      stripe_enabled: stripeConfigured(),
    });
  });

  app.post("/checkout", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    if (!stripeConfigured()) throw new HttpError(503, "billing_unavailable", "Le paiement en ligne n'est pas encore activé.");
    const b = await body(c.req, z.object({ plan: z.enum(["essentiel", "cabinet", "expert"]), interval: z.enum(["month", "year"]) }));
    const sub = ws.entitlements.subscription;
    if (sub?.stripe_subscription_id && ws.entitlements.status === "active") {
      // Plan changes go through the Customer Portal (proration handled by Stripe).
      return c.json({ url: await createPortalSession(ws.tenantId) });
    }
    const url = await createCheckoutSession({
      tenantId: ws.tenantId,
      workspaceName: ws.displayName,
      email: currentUser(c).email,
      plan: b.plan,
      interval: b.interval,
    });
    return c.json({ url });
  });

  app.post("/portal", async (c) => {
    const ws = currentWorkspace(c);
    assertRole(c, "owner");
    if (!stripeConfigured() || !ws.entitlements.subscription?.stripe_customer_id) {
      throw new HttpError(409, "no_billing_account", "Aucun abonnement payant pour le moment.");
    }
    return c.json({ url: await createPortalSession(ws.tenantId) });
  });

  return app;
}
