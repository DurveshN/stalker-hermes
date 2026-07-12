import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    runId: v.id("runs"),
    competitorId: v.id("competitors"),
    findingId: v.optional(v.id("findings")),
    kind: v.union(v.literal("issue"), v.literal("pr")),
    title: v.string(),
    body: v.string(),
    ghNumber: v.optional(v.number()),
    ghUrl: v.optional(v.string()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("actionItems", {
      ...args,
      ts: Date.now(),
    });
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("actionItems").order("desc").take(args.limit ?? 50);
  },
});

export const forRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("actionItems")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});
