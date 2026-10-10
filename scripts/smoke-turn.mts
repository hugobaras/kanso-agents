import { createApp } from "../apps/inbound-api/src/app.ts";

const app = createApp();
const start = await app.request("http://local/v1/demo-tenant/sessions", {
  method: "POST",
});
const started = (await start.json()) as { session_id: string };
const msg = await app.request(
  `http://local/v1/demo-tenant/sessions/${started.session_id}/messages`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "droit des sociétés" }),
  },
);
console.log(msg.status, await msg.json());
process.exit(msg.status === 200 ? 0 : 1);
