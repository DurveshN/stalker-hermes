import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Landing-page email capture (cross-track Virality/Revenue signal).
export const create = mutation({
  args: {
    email: v.string(),
    company: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("signups", {
      email: args.email,
      company: args.company,
      source: args.source,
      plan: "free",
      ts: Date.now(),
    });
  },
});

// First-use event — required for signups to "count" under the rubric.
export const markFirstUse = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (s && !s.firstUseAt) await ctx.db.patch(s._id, { firstUseAt: Date.now() });
  },
});

// Dodo webhook promotes a signup to Pro after live checkout.
export const upgradeToPro = mutation({
  args: {
    email: v.string(),
    dodoCustomerId: v.optional(v.string()),
    dodoSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (s) {
      await ctx.db.patch(s._id, {
        plan: "pro",
        dodoCustomerId: args.dodoCustomerId,
        dodoSubscriptionId: args.dodoSubscriptionId,
      });
    } else {
      await ctx.db.insert("signups", {
        email: args.email,
        plan: "pro",
        dodoCustomerId: args.dodoCustomerId,
        dodoSubscriptionId: args.dodoSubscriptionId,
        ts: Date.now(),
      });
    }
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("signups").collect();
    return {
      total: all.length,
      pro: all.filter((s) => s.plan === "pro").length,
      activated: all.filter((s) => s.firstUseAt).length,
    };
  },
});
