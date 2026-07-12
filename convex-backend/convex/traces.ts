import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { TRACE_TYPE } from "./schema";

// Emit one trace event. Called for every agent/tool/LLM step.
export const emit = mutation({
  args: {
    runId: v.id("runs"),
    parentSeq: v.optional(v.number()),
    seq: v.number(),
    agent: v.string(),
    type: TRACE_TYPE,
    label: v.string(),
    status: v.union(v.literal("ok"), v.literal("error"), v.literal("running")),
    model: v.optional(v.string()),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    input: v.optional(v.string()),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("traces", {
      runId: args.runId,
      parentSeq: args.parentSeq,
      seq: args.seq,
      agent: args.agent,
      type: args.type,
      label: args.label,
      status: args.status,
      model: args.model,
      tokensIn: args.tokensIn ?? 0,
      tokensOut: args.tokensOut ?? 0,
      costUsd: args.costUsd ?? 0,
      latencyMs: args.latencyMs ?? 0,
      input: args.input,
      output: args.output,
      error: args.error,
      ts: Date.now(),
    });
  },
});

// Full ordered trace list for a run (dashboard builds the tree from parentSeq).
export const forRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("traces")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

// Per-agent cost/latency rollup for a run (answers "which agent spent most").
export const rollupByAgent = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("traces")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    const byAgent: Record<
      string,
      { steps: number; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number; errors: number }
    > = {};
    for (const r of rows) {
      const a = (byAgent[r.agent] ??= {
        steps: 0,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencyMs: 0,
        errors: 0,
      });
      a.steps++;
      a.tokensIn += r.tokensIn;
      a.tokensOut += r.tokensOut;
      a.costUsd += r.costUsd;
      a.latencyMs += r.latencyMs;
      if (r.status === "error") a.errors++;
    }
    return byAgent;
  },
});

// Side-by-side run diff: aligns steps by (agent,type,label) so a regression
// shows up as a changed/added/removed step. Powers the L5 "diff two runs" view.
export const diff = query({
  args: { runA: v.id("runs"), runB: v.id("runs") },
  handler: async (ctx, args) => {
    const [a, b, ta, tb] = await Promise.all([
      ctx.db.get(args.runA),
      ctx.db.get(args.runB),
      ctx.db
        .query("traces")
        .withIndex("by_run", (q) => q.eq("runId", args.runA))
        .collect(),
      ctx.db
        .query("traces")
        .withIndex("by_run", (q) => q.eq("runId", args.runB))
        .collect(),
    ]);
    const key = (t: { agent: string; type: string; label: string }) =>
      `${t.agent}::${t.type}::${t.label}`;
    const mapA = new Map(ta.map((t) => [key(t), t]));
    const mapB = new Map(tb.map((t) => [key(t), t]));
    const keys = new Set([...mapA.keys(), ...mapB.keys()]);
    const rows = [...keys].map((k) => {
      const x = mapA.get(k);
      const y = mapB.get(k);
      let state: "same" | "changed" | "added" | "removed";
      if (x && !y) state = "removed";
      else if (!x && y) state = "added";
      else state = x!.status !== y!.status || x!.output !== y!.output ? "changed" : "same";
      return {
        key: k,
        agent: (x ?? y)!.agent,
        type: (x ?? y)!.type,
        label: (x ?? y)!.label,
        state,
        a: x ? { status: x.status, costUsd: x.costUsd, output: x.output } : null,
        b: y ? { status: y.status, costUsd: y.costUsd, output: y.output } : null,
      };
    });
    return { runA: a, runB: b, rows };
  },
});

// Cross-run search over trace labels/output (L5 "search across runs").
export const search = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const term = args.term.toLowerCase();
    const rows = await ctx.db.query("traces").order("desc").take(2000);
    return rows
      .filter(
        (r) =>
          r.label.toLowerCase().includes(term) ||
          (r.output ?? "").toLowerCase().includes(term) ||
          (r.error ?? "").toLowerCase().includes(term),
      )
      .slice(0, args.limit ?? 100);
  },
});
