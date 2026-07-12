import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Reusable literal unions ----------------------------------------------------
export const CHANNELS = v.union(
  v.literal("linkedin"),
  v.literal("twitter"),
  v.literal("news"),
  v.literal("blog"),
  v.literal("seo"),
  v.literal("product"),
);

export const SEVERITY = v.union(
  v.literal("info"),
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

export const RUN_STATUS = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("partial"),
);

export const TRACE_TYPE = v.union(
  v.literal("manager_plan"),
  v.literal("delegate"),
  v.literal("specialist"),
  v.literal("subspecialist"),
  v.literal("llm_call"),
  v.literal("linkup_query"),
  v.literal("dedup"),
  v.literal("score"),
  v.literal("synthesis"),
  v.literal("escalation"),
  v.literal("error"),
);

export default defineSchema({
  // Companies we track ------------------------------------------------------
  competitors: defineTable({
    name: v.string(),
    domain: v.optional(v.string()),
    aliases: v.array(v.string()),
    linkedinUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    priority: v.number(), // 1 (watch) .. 5 (primary threat)
    active: v.boolean(),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  }).index("by_active", ["active"]),

  // Tracker "role" config — the management-UI defined agent role ------------
  trackers: defineTable({
    competitorId: v.id("competitors"),
    channels: v.array(CHANNELS), // which specialists to run
    cadenceCron: v.string(), // e.g. "0 * * * *"
    depth: v.union(v.literal("fast"), v.literal("standard"), v.literal("deep")),
    spendCapUsd: v.number(), // guardrail
    escalateAtSeverity: SEVERITY, // threshold for Telegram/voice
    voiceBrief: v.boolean(),
    active: v.boolean(),
  }).index("by_competitor", ["competitorId"]),

  // Trigger bus: VM has no inbound ports, so triggers enqueue here ----------
  runQueue: defineTable({
    competitorId: v.optional(v.id("competitors")), // undefined = all active
    trigger: v.union(
      v.literal("cron"),
      v.literal("telegram"),
      v.literal("dashboard"),
      v.literal("worker"),
      v.literal("manual"),
    ),
    requestedBy: v.optional(v.string()),
    focus: v.optional(v.string()), // optional free-text focus for this run
    status: v.union(
      v.literal("queued"),
      v.literal("claimed"),
      v.literal("done"),
      v.literal("failed"),
    ),
    claimedBy: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    runId: v.optional(v.id("runs")),
  }).index("by_status", ["status"]),

  // One orchestration run ---------------------------------------------------
  runs: defineTable({
    competitorId: v.id("competitors"),
    competitorName: v.string(),
    trigger: v.string(),
    status: RUN_STATUS,
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    totalTokensIn: v.number(),
    totalTokensOut: v.number(),
    totalCostUsd: v.number(),
    plannedChannels: v.array(v.string()),
    findingsCount: v.number(),
    newFindingsCount: v.number(),
    escalations: v.number(),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    version: v.string(), // prompt/agent version for eval trend tracking
  })
    .index("by_competitor", ["competitorId"])
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"]),

  // Trace tree — one row per agent/tool step (observability core) -----------
  traces: defineTable({
    runId: v.id("runs"),
    parentSeq: v.optional(v.number()), // builds the who-called-whom tree (parent's seq)
    seq: v.number(), // ordering within a run
    agent: v.string(), // "manager" | "linkedin" | "seo" | ...
    type: TRACE_TYPE,
    label: v.string(),
    status: v.union(
      v.literal("ok"),
      v.literal("error"),
      v.literal("running"),
    ),
    model: v.optional(v.string()),
    tokensIn: v.number(),
    tokensOut: v.number(),
    costUsd: v.number(),
    latencyMs: v.number(),
    input: v.optional(v.string()), // truncated snapshot
    output: v.optional(v.string()), // truncated snapshot
    error: v.optional(v.string()),
    ts: v.number(),
  })
    .index("by_run", ["runId", "seq"])
    .index("by_run_agent", ["runId", "agent"]),

  // Extracted competitive-intel items --------------------------------------
  findings: defineTable({
    runId: v.id("runs"),
    competitorId: v.id("competitors"),
    channel: CHANNELS,
    title: v.string(),
    url: v.optional(v.string()),
    summary: v.string(),
    category: v.string(), // funding | product | hiring | marketing | pricing | partnership | other
    severity: SEVERITY,
    relevance: v.number(), // 0..1
    dedupHash: v.string(), // normalized hash for cross-run dedup
    publishedAt: v.optional(v.string()),
    isNew: v.boolean(),
    ts: v.number(),
  })
    .index("by_competitor", ["competitorId"])
    .index("by_run", ["runId"])
    .index("by_hash", ["dedupHash"])
    .index("by_severity", ["severity"]),

  // Escalations delivered to the human -------------------------------------
  alerts: defineTable({
    runId: v.id("runs"),
    competitorId: v.id("competitors"),
    findingId: v.optional(v.id("findings")),
    severity: SEVERITY,
    message: v.string(),
    deliveredVia: v.array(v.string()), // ["telegram","voice"]
    voiceUrl: v.optional(v.string()),
    acknowledged: v.boolean(),
    ts: v.number(),
  })
    .index("by_competitor", ["competitorId"])
    .index("by_ack", ["acknowledged"]),

  // Action queue: GitHub issues/PRs the crew files ------------------------
  actionItems: defineTable({
    runId: v.id("runs"),
    competitorId: v.id("competitors"),
    findingId: v.optional(v.id("findings")),
    kind: v.union(v.literal("issue"), v.literal("pr")),
    title: v.string(),
    body: v.string(),
    ghNumber: v.optional(v.number()),
    ghUrl: v.optional(v.string()),
    status: v.string(),
    ts: v.number(),
  })
    .index("by_competitor", ["competitorId"])
    .index("by_run", ["runId"]),

  // Eval cases + results (evaluation & iteration parameter) -----------------
  evalCases: defineTable({
    name: v.string(),
    competitorName: v.string(),
    focus: v.optional(v.string()),
    // assertions the crew output must satisfy
    minFindings: v.number(),
    requireSourceUrls: v.boolean(),
    expectCategories: v.array(v.string()),
    source: v.union(v.literal("seed"), v.literal("regression")), // closed-loop
    active: v.boolean(),
  }).index("by_active", ["active"]),

  evalRuns: defineTable({
    version: v.string(),
    startedAt: v.number(),
    passed: v.number(),
    total: v.number(),
    passRate: v.number(),
    details: v.string(), // JSON blob of per-case scores
  }).index("by_startedAt", ["startedAt"]),

  // User feedback on findings → feeds regression eval cases (closed loop) ---
  feedback: defineTable({
    findingId: v.id("findings"),
    competitorId: v.id("competitors"),
    verdict: v.union(v.literal("useful"), v.literal("wrong"), v.literal("noise")),
    note: v.optional(v.string()),
    ts: v.number(),
  }).index("by_finding", ["findingId"]),

  // Landing-page signups + Dodo subscription state (cross-track + Dodo) -----
  signups: defineTable({
    email: v.string(),
    company: v.optional(v.string()),
    source: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    dodoCustomerId: v.optional(v.string()),
    dodoSubscriptionId: v.optional(v.string()),
    firstUseAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    ts: v.number(),
  }).index("by_email", ["email"]),
});
