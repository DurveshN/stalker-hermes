import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const activeCases = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("evalCases")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
  },
});

export const addCase = mutation({
  args: {
    name: v.string(),
    competitorName: v.string(),
    focus: v.optional(v.string()),
    minFindings: v.number(),
    requireSourceUrls: v.boolean(),
    expectCategories: v.array(v.string()),
    source: v.union(v.literal("seed"), v.literal("regression")),
  },
  handler: async (ctx, args) => {
    // Dedup by name so regression capture doesn't pile up duplicates.
    const existing = (await ctx.db.query("evalCases").collect()).find(
      (c) => c.name === args.name,
    );
    if (existing) return existing._id;
    return await ctx.db.insert("evalCases", { ...args, active: true });
  },
});

export const recordRun = mutation({
  args: {
    version: v.string(),
    passed: v.number(),
    total: v.number(),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("evalRuns", {
      version: args.version,
      startedAt: Date.now(),
      passed: args.passed,
      total: args.total,
      passRate: args.total > 0 ? args.passed / args.total : 0,
      details: args.details,
    });
  },
});

// Pass-rate trend across versions — powers the "measurable gains" chart.
export const trend = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("evalRuns").withIndex("by_startedAt").order("asc").collect();
  },
});
