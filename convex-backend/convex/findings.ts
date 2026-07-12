import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { CHANNELS, SEVERITY } from "./schema";

// Insert a finding if its dedupHash hasn't been seen for this competitor.
// Returns { id, isNew } so the run can count genuinely-new intel.
export const upsert = mutation({
  args: {
    runId: v.id("runs"),
    competitorId: v.id("competitors"),
    channel: CHANNELS,
    title: v.string(),
    url: v.optional(v.string()),
    summary: v.string(),
    category: v.string(),
    severity: SEVERITY,
    relevance: v.number(),
    dedupHash: v.string(),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("findings")
      .withIndex("by_hash", (q) => q.eq("dedupHash", args.dedupHash))
      .first();
    if (existing) {
      return { id: existing._id, isNew: false };
    }
    const id = await ctx.db.insert("findings", {
      runId: args.runId,
      competitorId: args.competitorId,
      channel: args.channel,
      title: args.title,
      url: args.url,
      summary: args.summary,
      category: args.category,
      severity: args.severity,
      relevance: args.relevance,
      dedupHash: args.dedupHash,
      publishedAt: args.publishedAt,
      isNew: true,
      ts: Date.now(),
    });
    return { id, isNew: true };
  },
});

export const forCompetitor = query({
  args: { competitorId: v.id("competitors"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("findings")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const forRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("findings")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const feed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("findings").order("desc").take(args.limit ?? 60);
  },
});
