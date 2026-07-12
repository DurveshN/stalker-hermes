import { generateText, Output } from "ai";
import { z } from "zod";
import { managerLLM, usageTokens } from "../llm.js";
import { config } from "../config.js";
import type { Tracer } from "../trace.js";
import type { Memory } from "../memory.js";
import type { Id } from "../../../convex-backend/convex/_generated/dataModel.js";
import { runSpecialist } from "./specialist.js";
import { runSubSpecialist } from "./subspecialist.js";
import { type Channel, type Finding, SEVERITIES } from "./types.js";

const ALL_CHANNELS: Channel[] = ["linkedin", "twitter", "news", "blog", "seo", "product"];

const PlanSchema = z.object({
  selected: z
    .array(
      z.object({
        channel: z.enum(ALL_CHANNELS as [Channel, ...Channel[]]),
        reason: z.string().describe("Why this channel matters for THIS request"),
      }),
    )
    .describe("The specialists to dispatch, chosen for this specific request"),
  rationale: z.string().describe("Overall plan rationale"),
});

const SpawnSchema = z.object({
  spawn: z.array(
    z.object({
      roleName: z.string().describe("kebab-case dynamic role, e.g. funding-deep-dive"),
      focus: z.string().describe("The specific thing to investigate deeper"),
    }),
  ),
});

export interface ManagerResult {
  plannedChannels: string[];
  findings: (Finding & { channel: string })[];
  brief: string;
}

const sevRank = (s: string) => SEVERITIES.indexOf(s as any);

// The manager: reads THIS request, plans which specialists to run (dynamic
// delegation), delegates, reviews outputs, spawns sub-specialists on notable
// findings (emergent org), then synthesizes an executive brief.
export async function runManager(args: {
  memory: Memory;
  tracer: Tracer;
  runIdStr: string;
}): Promise<ManagerResult> {
  const { memory, tracer, runIdStr } = args;
  const { competitor, focus } = memory.now;
  const allowed = memory.rules.channels.filter((c): c is Channel =>
    ALL_CHANNELS.includes(c as Channel),
  );

  const rootSpan = await tracer.span({
    agent: "manager",
    type: "manager_plan",
    label: `Plan tracking for ${competitor}`,
    status: "running",
    input: { allowed, focus, priority: "n/a" },
  });

  // ---- Phase 1: PLAN (dynamic — different request ⇒ different plan) --------
  const planGen = await generateText({
    model: managerLLM,
    output: Output.object({ schema: PlanSchema }),
    system: `You are the MANAGER of a competitive-intelligence crew tracking "${competitor}".
Allowed channels this tracker may use: ${allowed.join(", ")}.
Choose the subset of channels to dispatch for THIS request and explain why each.
If the request has a focus, bias channel selection toward it. Recent known titles:
${memory.history.recentTitles.slice(0, 10).map((t) => `- ${t}`).join("\n") || "(none yet)"}`,
    prompt: focus
      ? `Request focus: "${focus}". Plan the specialist dispatch.`
      : `Routine hourly sweep. Plan the specialist dispatch.`,
  });
  const plan = planGen.output;
  const pu = usageTokens(planGen.usage);
  const planned = plan.selected
    .map((s) => s.channel)
    .filter((c) => allowed.includes(c));
  const plannedChannels = planned.length ? [...new Set(planned)] : allowed;
  await tracer.span({
    parentId: rootSpan,
    agent: "manager",
    type: "manager_plan",
    label: `Planned ${plannedChannels.length} specialists: ${plannedChannels.join(", ")}`,
    model: config.managerModel,
    tokensIn: pu.tokensIn,
    tokensOut: pu.tokensOut,
    output: plan.rationale,
  });

  // ---- Phase 2: DELEGATE (bounded parallelism) -----------------------------
  const collected: (Finding & { channel: string })[] = [];
  const batches: Channel[][] = [];
  for (let i = 0; i < plannedChannels.length; i += config.maxParallelSpecialists) {
    batches.push(plannedChannels.slice(i, i + config.maxParallelSpecialists) as Channel[]);
  }
  for (const batch of batches) {
    // Budget guard: manager stops delegating if the run cost cap is hit.
    if (tracer.totalCostUsd >= memory.rules.spendCapUsd) {
      await tracer.span({
        parentId: rootSpan,
        agent: "manager",
        type: "delegate",
        label: `Budget cap $${memory.rules.spendCapUsd} reached — stopping delegation`,
        status: "error",
      });
      break;
    }
    const results = await Promise.all(
      batch.map(async (channel) => {
        const delegateSpan = await tracer.span({
          parentId: rootSpan,
          agent: "manager",
          type: "delegate",
          label: `→ delegate to ${channel}`,
        });
        try {
          const out = await runSpecialist({
            channel,
            memory,
            tracer,
            parentId: delegateSpan,
            runIdStr,
          });
          return out.findings.map((f) => ({ ...f, channel }));
        } catch (e) {
          return [] as (Finding & { channel: string })[];
        }
      }),
    );
    for (const r of results) collected.push(...r);
  }

  // ---- Phase 3: REVIEW + SPAWN sub-specialists on notable findings ---------
  const notable = collected.filter((f) => sevRank(f.severity) >= sevRank("high"));
  if (notable.length && tracer.totalCostUsd < memory.rules.spendCapUsd) {
    const spawnGen = await generateText({
      model: managerLLM,
      output: Output.object({ schema: SpawnSchema }),
      system: `You are the manager reviewing high-severity findings on ${competitor}.
Decide if any warrant spawning a dedicated deep-dive sub-specialist (max 2).
Only spawn when a finding is material and under-explored.`,
      prompt: `High-severity findings:\n${notable
        .map((f) => `- [${f.category}/${f.severity}] ${f.title} (${f.url})`)
        .join("\n")}`,
    });
    const su = usageTokens(spawnGen.usage);
    await tracer.span({
      parentId: rootSpan,
      agent: "manager",
      type: "delegate",
      label: `Review → spawn ${spawnGen.output.spawn.length} sub-specialist(s)`,
      model: config.managerModel,
      tokensIn: su.tokensIn,
      tokensOut: su.tokensOut,
    });
    for (const s of spawnGen.output.spawn.slice(0, 2)) {
      if (tracer.totalCostUsd >= memory.rules.spendCapUsd) break;
      try {
        const deep = await runSubSpecialist({
          roleName: s.roleName,
          focus: s.focus,
          memory,
          tracer,
          parentId: rootSpan,
          runIdStr,
        });
        for (const f of deep.findings) collected.push({ ...f, channel: s.roleName });
      } catch {
        /* traced inside runSubSpecialist */
      }
    }
  }

  // ---- Phase 4: SYNTHESIZE executive brief ---------------------------------
  const synthGen = await generateText({
    model: managerLLM,
    system: `You are the manager. Write a tight competitive-intelligence brief on ${competitor}
from the crew's findings. Lead with what changed and why it matters to us. Be factual, cite nothing
you weren't given. If there are no findings, say monitoring continued with nothing material.`,
    prompt: `Findings (${collected.length}):\n${
      collected
        .map((f) => `- [${f.channel}/${f.category}/${f.severity}] ${f.title} — ${f.summary}`)
        .join("\n") || "(none)"
    }`,
  });
  const synu = usageTokens(synthGen.usage);
  await tracer.span({
    parentId: rootSpan,
    agent: "manager",
    type: "synthesis",
    label: `Synthesized brief`,
    model: config.managerModel,
    tokensIn: synu.tokensIn,
    tokensOut: synu.tokensOut,
    status: "ok",
    output: synthGen.text,
  });

  return { plannedChannels, findings: collected, brief: synthGen.text };
}
