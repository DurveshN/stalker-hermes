import { convex, convexSub, api } from "./convexClient.js";
import { config } from "./config.js";
import { initSchema } from "./db/postgres.js";
import { runCrew } from "./runCrew.js";
import type { Id } from "../../convex-backend/convex/_generated/dataModel.js";

// Orchestrator daemon. Subscribes to the Convex runQueue (VM has no inbound
// ports) and executes claimed jobs. Every trigger source — Hermes cron,
// Telegram command, dashboard, Cloudflare — just enqueues a row.

const inFlight = new Set<string>();

async function handleJob(job: {
  _id: Id<"runQueue">;
  competitorId?: Id<"competitors">;
  trigger: string;
  focus?: string;
}) {
  const key = job._id as unknown as string;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  // Atomic claim so duplicate subscription fires don't double-run.
  const claimed = await convex.mutation(api.runQueue.claim, {
    id: job._id,
    worker: config.workerId,
  });
  if (!claimed) {
    inFlight.delete(key);
    return;
  }

  try {
    // No competitor specified ⇒ sweep all active competitors.
    const targets: Id<"competitors">[] = job.competitorId
      ? [job.competitorId]
      : (await convex.query(api.competitors.list, { activeOnly: true })).map(
          (c) => c._id,
        );

    let lastRunId: Id<"runs"> | undefined;
    for (const competitorId of targets) {
      console.log(`[run] competitor=${competitorId} trigger=${job.trigger}`);
      const outcome = await runCrew({
        competitorId,
        trigger: job.trigger,
        focus: job.focus,
      });
      lastRunId = outcome.runId;
      console.log(
        `[done] run=${outcome.runId} new=${outcome.newFindings} escalations=${outcome.escalations}`,
      );
    }
    await convex.mutation(api.runQueue.complete, { id: job._id, runId: lastRunId });
  } catch (e) {
    console.error("[job failed]", e);
    await convex.mutation(api.runQueue.complete, { id: job._id, failed: true });
  } finally {
    inFlight.delete(key);
  }
}

async function main() {
  await initSchema();
  console.log(`Stalker Hermes orchestrator up. worker=${config.workerId}`);
  console.log(`Convex=${config.convexUrl}`);

  // Live subscription: fires whenever queued jobs change.
  convexSub.onUpdate(api.runQueue.pending, {}, (jobs) => {
    for (const job of jobs) void handleJob(job as any);
  });

  // Safety poll in case a subscription hiccup drops an event.
  setInterval(async () => {
    try {
      const jobs = await convex.query(api.runQueue.pending, {});
      for (const job of jobs) void handleJob(job as any);
    } catch (e) {
      console.error("[poll error]", e);
    }
  }, config.runQueuePollMs);
}

main().catch((e) => {
  console.error("fatal", e);
  process.exit(1);
});
