import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Any trigger source calls this to request a tracking run.
export const enqueue = mutation({
  args: {
    competitorId: v.optional(v.id("competitors")),
    trigger: v.union(
      v.literal("cron"),
      v.literal("telegram"),
      v.literal("dashboard"),
      v.literal("worker"),
      v.literal("manual"),
      v.literal("slack"),
    ),
    requestedBy: v.optional(v.string()),
    focus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runQueue", {
      competitorId: args.competitorId,
      trigger: args.trigger,
      requestedBy: args.requestedBy,
      focus: args.focus,
      status: "queued",
    });
  },
});

// Orchestrator subscribes to this and picks up queued jobs.
export const pending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("runQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
  },
});

// Atomic claim so a job runs once even if the subscriber fires twice.
export const claim = mutation({
  args: { id: v.id("runQueue"), worker: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job || job.status !== "queued") return null;
    await ctx.db.patch(args.id, {
      status: "claimed",
      claimedBy: args.worker,
      claimedAt: Date.now(),
    });
    return { ...job, status: "claimed" as const };
  },
});

export const complete = mutation({
  args: {
    id: v.id("runQueue"),
    runId: v.optional(v.id("runs")),
    failed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.failed ? "failed" : "done",
      runId: args.runId,
    });
  },
});
