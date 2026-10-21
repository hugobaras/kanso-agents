import { describe, expect, it } from "vitest";
import { computeEntitlements, type SubscriptionRow } from "./entitlements.js";
import { currentPeriod } from "./quota.js";
import { lookupKey, parseLookupKey } from "./plans.js";

const now = new Date("2026-10-14T10:00:00Z");

function sub(partial: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    tenant_id: "t",
    plan: "trial",
    status: "trialing",
    billing_interval: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: null,
    current_period_end: null,
    cancel_at_period_end: false,
    ...partial,
  };
}

describe("computeEntitlements", () => {
  it("active trial with days left", () => {
    const e = computeEntitlements(
      sub({ trial_ends_at: new Date("2026-10-20T10:00:00Z") }),
      null,
      now,
    );
    expect(e.active).toBe(true);
    expect(e.trialDaysLeft).toBe(6);
    expect(e.modules.document_to_action).toBe(true);
  });

  it("expired trial is read-only", () => {
    const e = computeEntitlements(
      sub({ trial_ends_at: new Date("2026-10-01T10:00:00Z") }),
      null,
      now,
    );
    expect(e.status).toBe("expired");
    expect(e.active).toBe(false);
  });

  it("essentiel never grants document_to_action", () => {
    const e = computeEntitlements(
      sub({ plan: "essentiel", status: "active" }),
      { inbound: true, document_to_action: true },
      now,
    );
    expect(e.modules.document_to_action).toBe(false);
    expect(e.quotas.conversations).toBe(200);
  });

  it("portail is opt-in, never granted by a plan alone", () => {
    expect(computeEntitlements(sub({ plan: "expert", status: "active" }), null, now).modules.portail).toBe(false);
    expect(computeEntitlements(sub({ plan: "expert", status: "active" }), { portail: true }, now).modules.portail).toBe(true);
  });

  it("no subscription → expired", () => {
    expect(computeEntitlements(null, null, now).active).toBe(false);
  });
});

describe("helpers", () => {
  it("period is Paris month", () => {
    expect(currentPeriod(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });
  it("lookup keys roundtrip", () => {
    expect(parseLookupKey(lookupKey("cabinet", "year"))).toEqual({
      plan: "cabinet",
      interval: "year",
    });
    expect(parseLookupKey("other")).toBeNull();
  });
});

describe("plans Portail", () => {
  it("grants only the portail module, with its own seats", () => {
    const e = computeEntitlements(sub({ plan: "portail_cabinet", status: "active" }), null, now);
    expect(e.plan.product).toBe("portail");
    expect(e.modules).toEqual({ inbound: false, document_to_action: false, portail: true });
    expect(e.seats).toBe(10);
  });

  it("round-trips the Portail lookup keys", () => {
    expect(lookupKey("portail_essentiel", "month")).toBe("kanso_portail_essentiel_month");
    expect(parseLookupKey("kanso_portail_cabinet_year")).toEqual({ plan: "portail_cabinet", interval: "year" });
  });

  it("keeps portail closed on Assistant plans unless Kanso opens the beta", () => {
    expect(computeEntitlements(sub({ plan: "cabinet", status: "active" }), null, now).modules.portail).toBe(false);
    expect(computeEntitlements(sub({ plan: "cabinet", status: "active" }), { portail: true }, now).modules.portail).toBe(true);
  });
});
