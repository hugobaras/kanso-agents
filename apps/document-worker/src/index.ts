import { persistWorkerHeartbeat, workerHeartbeat } from "./heartbeat.js";
import { processInboxOnce } from "./inbox-once.js";
import { pollLoop, pollOnce } from "./poll.js";
import { processOnceMock } from "./process-once.js";

async function main() {
  console.log(
    JSON.stringify({
      level: "info",
      msg: "document-worker starting",
      ...workerHeartbeat(),
    }),
  );
  await persistWorkerHeartbeat({ last: "starting" });

  if (process.env.KANSO_WORKER_BOOTSTRAP !== "0") {
    const result = await processOnceMock();
    console.log(
      JSON.stringify({
        level: "info",
        msg: "document-worker mock pipeline",
        step: result.job.step,
        remote_id: result.job.remoteId ?? null,
        anomaly: result.job.anomalyReason ?? null,
        drafts: result.drafts,
      }),
    );
    const inbox = await processInboxOnce();
    console.log(
      JSON.stringify({
        level: "info",
        msg: "document-worker email_inbox once",
        ...inbox,
      }),
    );
  }

  if (process.env.KANSO_WORKER_POLL === "0") {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "document-worker poll disabled",
        ...workerHeartbeat(),
      }),
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "document-worker no DATABASE_URL — skip poll",
      }),
    );
    return;
  }

  if (process.env.KANSO_WORKER_ONCE === "1") {
    const worked = await pollOnce();
    console.log(
      JSON.stringify({
        level: "info",
        msg: "document-worker poll once",
        claimed: worked,
        ...workerHeartbeat(),
      }),
    );
    return;
  }

  console.log(
    JSON.stringify({
      level: "info",
      msg: "document-worker poll loop",
      ...workerHeartbeat(),
    }),
  );
  await pollLoop({});
}

main().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "document-worker failed",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
