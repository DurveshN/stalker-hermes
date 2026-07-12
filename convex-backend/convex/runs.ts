import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { RUN_STATUS } from "./schema";

export const start = mutation({
  args: {
    competitorId: v.id("competitors"),
    competitorName: v.string(),
    trigger: v.string(),
    plannedChannels: v.array(v.string()),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runs", {
      competitorId: args.competitorId,
      competitorName: args.competitorName,
      trigger: args.trigger,
      status: "running",
      startedAt: Date.now(),
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCostUsd: 0,
      plannedChannels: args.plannedChannels,
      findingsCount: 0,
      newFindingsCount: 0,
      escalations: 0,
      version: args.version,
    });
  },
});

export const finish = mutation({
  args: {
    id: v.id("runs"),
    status: RUN_STATUS,
    totalTokensIn: v.number(),
    totalTokensOut: v.number(),
    totalCostUsd: v.number(),
    findingsCount: v.number(),
    newFindingsCount: v.number(),
    escalations: v.number(),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) return;
    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      finishedAt: Date.now(),
      latencyMs: Date.now() - run.startedAt,
    });
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_startedAt")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const get = query({
  args: { id: v.id("runs") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const forCompetitor = query({
  args: { competitorId: v.id("competitors"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});
