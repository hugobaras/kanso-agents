/**
 * Smoke onboarding design partner : session + message + présence usage.
 * Prérequis : tenant demo-tenant (ou DESIGN_PARTNER_TENANT) + config published + DB.
 */
import { createApp } from "../apps/inbound-api/src/app.ts";

const tenant = process.env.DESIGN_PARTNER_TENANT ?? "demo-tenant";
const app = createApp();

const start = await app.request(`http://local/v1/${tenant}/sessions`, {
  method: "POST",
});
if (start.status !== 200) {
  console.error("session failed", start.status, await start.text());
  process.exit(1);
}
const started = (await start.json()) as {
  session_id: string;
  assistant_message: string;
};
if (!/automatisé|assistant|IA|humain/i.test(started.assistant_message)) {
  console.error("disclaimer missing in first message");
  process.exit(1);
}

const msg = await app.request(
  `http://local/v1/${tenant}/sessions/${started.session_id}/messages`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "corporate" }),
  },
);
const body = (await msg.json()) as {
  usage?: { calls?: number };
  assistant_message?: string;
};
if (msg.status !== 200) {
  console.error("message failed", msg.status, body);
  process.exit(1);
}
if (!body.usage || (body.usage.calls ?? 0) < 1) {
  console.error("usage not recorded", body);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    tenant,
    session_id: started.session_id,
    usage_calls: body.usage.calls,
  }),
);
process.exit(0);
