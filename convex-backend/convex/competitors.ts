import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return await ctx.db
        .query("competitors")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();
    }
    return await ctx.db.query("competitors").collect();
  },
});

export const get = query({
  args: { id: v.id("competitors") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const add = mutation({
  args: {
    name: v.string(),
    domain: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    linkedinUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    priority: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const competitorId = await ctx.db.insert("competitors", {
      name: args.name,
      domain: args.domain,
      aliases: args.aliases ?? [],
      linkedinUrl: args.linkedinUrl,
      twitterHandle: args.twitterHandle,
      priority: args.priority ?? 3,
      active: true,
      notes: args.notes,
      createdBy: args.createdBy,
    });
    // Auto-create a default tracker role so tracking works out of the box.
    await ctx.db.insert("trackers", {
      competitorId,
      channels: ["linkedin", "twitter", "news", "blog", "seo", "product"],
      cadenceCron: "0 * * * *",
      depth: "standard",
      spendCapUsd: 0.5,
      escalateAtSeverity: "high",
      voiceBrief: true,
      active: true,
    });
    return competitorId;
  },
});

export const update = mutation({
  args: {
    id: v.id("competitors"),
    patch: v.object({
      name: v.optional(v.string()),
      domain: v.optional(v.string()),
      aliases: v.optional(v.array(v.string())),
      linkedinUrl: v.optional(v.string()),
      twitterHandle: v.optional(v.string()),
      priority: v.optional(v.number()),
      active: v.optional(v.boolean()),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.patch);
  },
});

export const remove = mutation({
  args: { id: v.id("competitors") },
  handler: async (ctx, args) => {
    const trackers = await ctx.db
      .query("trackers")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.id))
      .collect();
    for (const t of trackers) await ctx.db.delete(t._id);
    await ctx.db.delete(args.id);
  },
});
