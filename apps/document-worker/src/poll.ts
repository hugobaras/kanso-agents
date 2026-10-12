import { claimNextJob } from "@kanso/document-pipeline";
import { getPool } from "@kanso/tenancy";
import { persistWorkerHeartbeat } from "./heartbeat.js";
import { processClaimedJob } from "./process-job.js";
import { runDueJobs } from "./scheduler.js";

export async function pollOnce(): Promise<boolean> {
  const pool = getPool();
  const job = await claimNextJob(pool);
  if (!job) return false;
  console.log(
    JSON.stringify({
      level: "info",
      msg: "document-worker claimed",
      job_id: job.id,
      tenant_id: job.tenant_id,
      attempt: job.attempt_count,
    }),
  );
  await processClaimedJob(job);
  await persistWorkerHeartbeat({ last: "claimed", job_id: job.id });
  return true;
}

export async function pollLoop(opts: {
  intervalMs?: number;
  maxIdleRounds?: number;
}): Promise<void> {
  const intervalMs = opts.intervalMs ?? Number(process.env.KANSO_POLL_MS ?? 2000);
  const maxIdle = opts.maxIdleRounds ?? Number(process.env.KANSO_POLL_IDLE_EXIT ?? 0);
  let idle = 0;
  let lastSchedule = 0;
  const scheduler = process.env.KANSO_SCHEDULER !== "0";
  for (;;) {
    if (scheduler && Date.now() - lastSchedule > 30_000) {
      lastSchedule = Date.now();
      await runDueJobs().catch((err: unknown) =>
        console.error(JSON.stringify({ level: "error", event: "scheduler_failed", message: err instanceof Error ? err.message : String(err) })),
      );
    }
    const worked = await pollOnce();
    if (worked) {
      idle = 0;
      continue;
    }
    idle += 1;
    await persistWorkerHeartbeat({ last: "idle", idle_rounds: idle });
    if (maxIdle > 0 && idle >= maxIdle) {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "document-worker poll idle exit",
          idle_rounds: idle,
        }),
      );
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
