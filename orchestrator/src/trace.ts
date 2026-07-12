import { convex, api } from "./convexClient.js";
import type { Id } from "../../convex-backend/convex/_generated/dataModel.js";
import { costUsd } from "./config.js";

type TraceType =
  | "manager_plan" | "delegate" | "specialist" | "subspecialist"
  | "llm_call" | "linkup_query" | "dedup" | "score" | "synthesis"
  | "escalation" | "error";

function truncate(s: unknown, n = 4000): string | undefined {
  if (s == null) return undefined;
  const str = typeof s === "string" ? s : JSON.stringify(s);
  return str.length > n ? str.slice(0, n) + "…[truncated]" : str;
}

// Tracer owns the sequence counter and running cost/token totals for a run.
// Each span is a node in the trace tree (parentId links to its caller).
export class Tracer {
  private seq = 0;
  totalTokensIn = 0;
  totalTokensOut = 0;
  totalCostUsd = 0;

  constructor(public runId: Id<"runs">) {}

  async span(opts: {
    parentId?: Id<"traces">;
    agent: string;
    type: TraceType;
    label: string;
    status?: "ok" | "error" | "running";
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    latencyMs?: number;
    input?: unknown;
    output?: unknown;
    error?: string;
  }): Promise<Id<"traces">> {
    const tokensIn = opts.tokensIn ?? 0;
    const tokensOut = opts.tokensOut ?? 0;
    const cost = opts.model ? costUsd(opts.model, tokensIn, tokensOut) : 0;
    this.totalTokensIn += tokensIn;
    this.totalTokensOut += tokensOut;
    this.totalCostUsd += cost;

    return await convex.mutation(api.traces.emit, {
      runId: this.runId,
      parentId: opts.parentId,
      seq: this.seq++,
      agent: opts.agent,
      type: opts.type,
      label: opts.label,
      status: opts.status ?? "ok",
      model: opts.model,
      tokensIn,
      tokensOut,
      costUsd: cost,
      latencyMs: opts.latencyMs ?? 0,
      input: truncate(opts.input),
      output: truncate(opts.output),
      error: opts.error,
    });
  }

  // Wrap an async unit of work as a timed span. Records error spans on throw.
  async track<T>(
    meta: { parentId?: Id<"traces">; agent: string; type: TraceType; label: string; input?: unknown },
    fn: () => Promise<{ result: T; tokensIn?: number; tokensOut?: number; model?: string; output?: unknown }>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const r = await fn();
      await this.span({
        ...meta,
        status: "ok",
        model: r.model,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        latencyMs: Date.now() - started,
        output: r.output,
      });
      return r.result;
    } catch (e) {
      await this.span({
        ...meta,
        status: "error",
        latencyMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }
}
