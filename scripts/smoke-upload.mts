/**
 * Upload document → poll worker once → GET job status.
 * Prérequis: DB, config document_to_action published, API deps built.
 */
import { createApp } from "../apps/inbound-api/src/app.ts";
import { pollOnce } from "../apps/document-worker/src/poll.ts";

const tenant = process.env.DESIGN_PARTNER_TENANT ?? "demo-tenant";
const app = createApp();

const pdf = Buffer.from("%PDF-1.4 smoke upload");
const up = await app.request(`http://local/v1/${tenant}/documents`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    content_base64: pdf.toString("base64"),
    filename: "smoke.pdf",
  }),
});
const uploaded = (await up.json()) as { job_id?: string; error?: string };
if (up.status !== 202 || !uploaded.job_id) {
  console.error("upload failed", up.status, uploaded);
  process.exit(1);
}

const claimed = await pollOnce();
const get = await app.request(
  `http://local/v1/${tenant}/documents/${uploaded.job_id}`,
);
const job = (await get.json()) as {
  status?: string;
  step?: string;
  remote_id?: string;
};
console.log(
  JSON.stringify({
    ok: get.status === 200 && job.status === "succeeded",
    job_id: uploaded.job_id,
    claimed,
    status: job.status,
    step: job.step,
    remote_id: job.remote_id,
  }),
);
process.exit(get.status === 200 && job.status === "succeeded" ? 0 : 1);
