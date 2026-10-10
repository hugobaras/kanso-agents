import { describe, expect, it, vi } from "vitest";
import {
  ConsoleEmailAlertAdapter,
  SmtpEmailAlertAdapter,
  createEmailAlertAdapter,
} from "./email.js";
import { withAdapterRetry } from "./retry.js";

describe("createEmailAlertAdapter", () => {
  it("uses console when no SMTP host", () => {
    const adapter = createEmailAlertAdapter({
      provider: "email",
      tenantId: "t1",
      credentials: { to: "ops@example.com" },
    });
    expect(adapter).toBeInstanceOf(ConsoleEmailAlertAdapter);
  });

  it("uses SMTP when host present", () => {
    const adapter = createEmailAlertAdapter({
      provider: "email",
      tenantId: "t1",
      credentials: {
        host: "ssl0.ovh.net",
        from: "alerts@kanso.example",
        to: "ops@example.com",
      },
    });
    expect(adapter).toBeInstanceOf(SmtpEmailAlertAdapter);
  });
});

describe("SmtpEmailAlertAdapter", () => {
  it("sends mail via transporter", async () => {
    const sendMail = vi.fn(async () => ({ messageId: "msg-1" }));
    const createTransport = vi.fn(() => ({ sendMail }));
    const adapter = new SmtpEmailAlertAdapter(
      createTransport as unknown as typeof import("nodemailer").createTransport,
    );
    const result = await adapter.send(
      {
        channel: "email",
        event: "hot_lead",
        title: "Lead",
        body: "score=75",
        metadata: { score: 75 },
      },
      {
        provider: "email",
        tenantId: "t1",
        credentials: {
          host: "smtp.example.com",
          port: "587",
          user: "u",
          pass: "p",
          from: "from@example.com",
          to: "to@example.com",
        },
      },
      {
        tenantId: "t1",
        correlationId: "c1",
        configVersion: 1,
        attempt: 1,
      },
    );
    expect(result.status).toBe("ok");
    expect(sendMail).toHaveBeenCalled();
  });
});

describe("withAdapterRetry", () => {
  it("retries retryable then succeeds", async () => {
    let n = 0;
    const result = await withAdapterRetry(
      async () => {
        n += 1;
        if (n < 3) {
          return {
            status: "retryable" as const,
            errorCode: "tmp",
            message: "tmp",
          };
        }
        return { status: "ok" as const, data: { delivered: true as const } };
      },
      { sleep: async () => undefined },
    );
    expect(result.status).toBe("ok");
    expect(n).toBe(3);
  });
});
