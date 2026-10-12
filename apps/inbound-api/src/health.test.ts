import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("inbound-api health", () => {
  it("returns ok", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      service: string;
      db: { ok: boolean };
      worker: { stale: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("inbound-api");
    expect(body.db).toBeDefined();
    expect(body.worker).toBeDefined();
  });
});
