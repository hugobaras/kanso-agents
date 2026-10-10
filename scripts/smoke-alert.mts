import { createApp } from "../apps/inbound-api/src/app.ts";

const app = createApp();
const start = await app.request("http://local/v1/demo-tenant/sessions", {
  method: "POST",
});
const { session_id } = (await start.json()) as { session_id: string };

const texts = ["sociétés", "urgent 48h", "lead@example.com"];
let last: unknown;
for (const text of texts) {
  const res = await app.request(
    `http://local/v1/demo-tenant/sessions/${session_id}/messages`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
  last = await res.json();
}
console.log(JSON.stringify(last, null, 2));
