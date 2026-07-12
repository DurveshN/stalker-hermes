import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { SEVERITY } from "./schema";

export const create = mutation({
  args: {
    runId: v.id("runs"),
    competitorId: v.id("competitors"),
    findingId: v.optional(v.id("findings")),
    severity: SEVERITY,
    message: v.string(),
    deliveredVia: v.array(v.string()),
    voiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      ...args,
      acknowledged: false,
      ts: Date.now(),
    });
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("alerts").order("desc").take(args.limit ?? 50);
  },
});

export const acknowledge = mutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { acknowledged: true });
  },
});
