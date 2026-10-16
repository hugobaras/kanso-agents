import { Hono } from "hono";
import type { AppEnv } from "../http/types.js";
import { handleStripeEvent, stripe, stripeConfigured } from "../services/stripe.js";

export function stripeRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/webhook", async (c) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeConfigured() || !secret) return c.json({ error: "billing_unavailable" }, 503);
    const signature = c.req.header("stripe-signature");
    if (!signature) return c.json({ error: "missing_signature" }, 400);
    const raw = await c.req.text();
    let event;
    try {
      event = await stripe().webhooks.constructEventAsync(raw, signature, secret);
    } catch {
      return c.json({ error: "invalid_signature" }, 400);
    }
    const outcome = await handleStripeEvent(event);
    console.log(JSON.stringify({ level: "info", event: "stripe_webhook", type: event.type, id: event.id, outcome }));
    return c.json({ received: true, outcome });
  });

  return app;
}
