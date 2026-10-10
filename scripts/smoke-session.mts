import { createApp } from "../apps/inbound-api/src/app.ts";

const app = createApp();
const res = await app.request("http://local/v1/demo-tenant/sessions", {
  method: "POST",
});
console.log(res.status, await res.json());
process.exit(res.status === 200 ? 0 : 1);
