import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// A human marks a finding useful/wrong/noise. "wrong" findings become
// regression eval cases (closed-loop evaluation).
export const submit = mutation({
  args: {
    findingId: v.id("findings"),
    verdict: v.union(v.literal("useful"), v.literal("wrong"), v.literal("noise")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new Error("finding not found");
    await ctx.db.insert("feedback", {
      findingId: args.findingId,
      competitorId: finding.competitorId,
      verdict: args.verdict,
      note: args.note,
      ts: Date.now(),
    });

    if (args.verdict === "wrong") {
      const competitor = await ctx.db.get(finding.competitorId);
      const name = `regression:${finding._id}`;
      const dup = (await ctx.db.query("evalCases").collect()).find(
        (c) => c.name === name,
      );
      if (!dup && competitor) {
        await ctx.db.insert("evalCases", {
          name,
          competitorName: competitor.name,
          focus: `Avoid regression on wrongly-reported: "${finding.title}"`,
          minFindings: 1,
          requireSourceUrls: true,
          expectCategories: [finding.category],
          source: "regression",
          active: true,
        });
      }
    }
  },
});

export const forFinding = query({
  args: { findingId: v.id("findings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feedback")
      .withIndex("by_finding", (q) => q.eq("findingId", args.findingId))
      .collect();
  },
});
