import { describe, expect, it, vi } from "vitest";
import {
  ConsoleSlackAlertAdapter,
  SlackWebhookAlertAdapter,
  createSlackAlertAdapter,
} from "./slack.js";

const ctx = {
  tenantId: "t1",
  correlationId: "c1",
  configVersion: 1,
  attempt: 1,
};

describe("createSlackAlertAdapter", () => {
  it("uses console without webhook", () => {
    expect(
      createSlackAlertAdapter({
        provider: "slack",
        tenantId: "t1",
        credentials: {},
      }),
    ).toBeInstanceOf(ConsoleSlackAlertAdapter);
  });

  it("uses webhook when url present", () => {
    expect(
      createSlackAlertAdapter({
        provider: "slack",
        tenantId: "t1",
        credentials: { webhook_url: "https://hooks.slack.com/services/x" },
      }),
    ).toBeInstanceOf(SlackWebhookAlertAdapter);
  });
});

describe("SlackWebhookAlertAdapter", () => {
  it("POSTs payload", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const adapter = new SlackWebhookAlertAdapter(fetchImpl);
    const result = await adapter.send(
      {
        channel: "slack",
        event: "hot_lead",
        title: "Lead",
        body: "score=75",
        metadata: { score: 75 },
      },
      {
        provider: "slack",
        tenantId: "t1",
        credentials: { webhook_url: "https://hooks.slack.com/services/x" },
      },
      ctx,
    );
    expect(result.status).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
