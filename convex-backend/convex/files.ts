import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Orchestrator calls this, POSTs audio bytes to the returned URL, then passes
// the resulting storageId to alerts.create via a resolved public URL.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => await ctx.storage.getUrl(args.storageId),
});
