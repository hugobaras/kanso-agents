import type { Pool } from "pg";
import { PLANS, isPlanId, type Metric, type Plan, type PlanId } from "./plans.js";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "expired";

export type SubscriptionRow = {
  tenant_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  billing_interval: "month" | "year" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
};

export type Entitlements = {
  plan: Plan;
  status: SubscriptionStatus;
  /** false → lecture seule : widget indisponible, uploads refusés. */
  active: boolean;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
  modules: { inbound: boolean; document_to_action: boolean };
  quotas: Record<Metric, number>;
  seats: number;
  subscription: SubscriptionRow | null;
};

const DAY_MS = 86_400_000;

/** Pure: derive entitlements from a subscription row + tenant module flags. */
export function computeEntitlements(
  sub: SubscriptionRow | null,
  tenantModules: { inbound?: boolean; document_to_action?: boolean } | null,
  now = new Date(),
): Entitlements {
  const planId: PlanId = sub && isPlanId(sub.plan) ? sub.plan : "trial";
  const plan = PLANS[planId];
  let status: SubscriptionStatus = sub?.status ?? "expired";
  const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;

  if (status === "trialing" && trialEndsAt && trialEndsAt.getTime() < now.getTime()) {
    status = "expired";
  }
  // past_due keeps service during Stripe's dunning window.
  const active = status === "trialing" || status === "active" || status === "past_due";

  const trialDaysLeft =
    status === "trialing" && trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS))
      : null;

  // Workspace can disable a module it is entitled to, never enable one it is not.
  const modules = {
    inbound: plan.modules.inbound && tenantModules?.inbound !== false,
    document_to_action:
      plan.modules.document_to_action && tenantModules?.document_to_action !== false,
  };

  return {
    plan,
    status,
    active,
    trialEndsAt,
    trialDaysLeft,
    modules,
    quotas: plan.quotas,
    seats: plan.seats,
    subscription: sub,
  };
}

export async function loadSubscription(
  pool: Pool,
  tenantId: string,
): Promise<SubscriptionRow | null> {
  const res = await pool.query<SubscriptionRow>(
    `select tenant_id, plan, status, billing_interval, stripe_customer_id,
            stripe_subscription_id, trial_ends_at, current_period_end, cancel_at_period_end
     from subscriptions where tenant_id = $1`,
    [tenantId],
  );
  return res.rows[0] ?? null;
}

export async function getEntitlements(
  pool: Pool,
  tenantId: string,
  now = new Date(),
): Promise<Entitlements> {
  const [sub, tenant] = await Promise.all([
    loadSubscription(pool, tenantId),
    pool.query<{ modules: Record<string, boolean> | null; status: string }>(
      `select modules, status from tenants where tenant_id = $1`,
      [tenantId],
    ),
  ]);
  const ent = computeEntitlements(sub, tenant.rows[0]?.modules ?? null, now);
  if (tenant.rows[0]?.status === "suspended") {
    return { ...ent, active: false };
  }
  return ent;
}
