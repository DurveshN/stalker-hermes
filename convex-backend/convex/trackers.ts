import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { CHANNELS, SEVERITY } from "./schema";

export const forCompetitor = query({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trackers")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .first();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const trackers = await ctx.db.query("trackers").collect();
    return trackers.filter((t) => t.active);
  },
});

// The management-UI "define a tracker role" action. A non-eng picks channels,
// depth, spend cap and severity threshold — that IS the agent role definition.
export const upsert = mutation({
  args: {
    competitorId: v.id("competitors"),
    channels: v.array(CHANNELS),
    cadenceCron: v.optional(v.string()),
    depth: v.optional(
      v.union(v.literal("fast"), v.literal("standard"), v.literal("deep")),
    ),
    spendCapUsd: v.optional(v.number()),
    escalateAtSeverity: v.optional(SEVERITY),
    voiceBrief: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("trackers")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .first();
    const doc = {
      competitorId: args.competitorId,
      channels: args.channels,
      cadenceCron: args.cadenceCron ?? "0 * * * *",
      depth: args.depth ?? "standard",
      spendCapUsd: args.spendCapUsd ?? 0.5,
      escalateAtSeverity: args.escalateAtSeverity ?? "high",
      voiceBrief: args.voiceBrief ?? true,
      active: args.active ?? true,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("trackers", doc);
  },
});
