import { generateText, tool, isStepCount, Output } from "ai";
import { z } from "zod";
import { specialistLLM, usageTokens } from "../llm.js";
import { config } from "../config.js";
import { linkupSearchResults, type Depth } from "../linkup.js";
import { saveRawSearch } from "../db/postgres.js";
import type { Tracer } from "../trace.js";
import type { Memory } from "../memory.js";
import type { Id } from "../../../convex-backend/convex/_generated/dataModel.js";
import {
  type Channel,
  CHANNEL_BRIEF,
  SpecialistOutputSchema,
  type SpecialistOutput,
} from "./types.js";

// A specialist runs an agentic Linkup loop for one channel, then extracts a
// structured list of findings. Every Linkup call + LLM call is traced as a
// child of the specialist's own span (builds the who-called-whom tree).
export async function runSpecialist(args: {
  channel: Channel;
  memory: Memory;
  tracer: Tracer;
  parentId: Id<"traces">;
  runIdStr: string;
}): Promise<SpecialistOutput> {
  const { channel, memory, tracer, parentId, runIdStr } = args;
  const brief = CHANNEL_BRIEF[channel];
  const depth: Depth = memory.rules.depth;
  const { competitor, aliases, domain, focus } = memory.now;

  const specSpan = await tracer.span({
    parentId,
    agent: channel,
    type: "specialist",
    label: `${brief.role} · ${competitor}`,
    status: "running",
    input: { channel, depth, focus },
  });

  const recent = memory.history.recentTitles.slice(0, 15);
  const system = [
    `You are the ${brief.role} on a competitive-intelligence crew.`,
    `Target competitor: ${competitor}${aliases.length ? ` (aka ${aliases.join(", ")})` : ""}.`,
    domain ? `Their domain: ${domain}.` : "",
    `Your beat: ${brief.guidance}`,
    focus ? `This run's focus: ${focus}.` : "",
    `Use the linkup_search tool to find RECENT (prefer last 30 days) developments.`,
    `Run 1-3 targeted searches. Only report items you actually found in search results — never invent URLs.`,
    recent.length
      ? `Already-known items (do NOT re-report unless materially updated):\n- ${recent.join("\n- ")}`
      : "",
    `When done searching, stop. A separate step will extract the structured findings.`,
  ]
    .filter(Boolean)
    .join("\n");

  // Tool: Linkup search, traced per call + raw payload archived to Postgres.
  const linkup_search = tool({
    description:
      "Search the live web via Linkup for recent developments about the competitor on your channel.",
    inputSchema: z.object({
      query: z.string().describe("Focused natural-language search query"),
    }),
    execute: async ({ query }) => {
      const started = Date.now();
      const { results, raw } = await linkupSearchResults(query, depth, {
        maxResults: 8,
        fromDate: new Date(Date.now() - 45 * 24 * 3600 * 1000),
      });
      await saveRawSearch({ runId: runIdStr, competitor, channel, depth, query, response: raw });
      await tracer.span({
        parentId: specSpan,
        agent: channel,
        type: "linkup_query",
        label: `linkup(${depth}): ${query.slice(0, 60)}`,
        status: "ok",
        latencyMs: Date.now() - started,
        input: query,
        output: results.map((r) => `${r.name} — ${r.url}`).join("\n"),
      });
      return results.slice(0, 8);
    },
  });

  // Phase 1: agentic search loop.
  const searchPhase = await generateText({
    model: specialistLLM,
    system,
    prompt: `Find the latest developments for ${competitor} on your channel. Search now.`,
    tools: { linkup_search },
    stopWhen: isStepCount(5),
  });
  const u1 = usageTokens(searchPhase.usage);
  await tracer.span({
    parentId: specSpan,
    agent: channel,
    type: "llm_call",
    label: `${channel} search reasoning`,
    model: config.specialistModel,
    tokensIn: u1.tokensIn,
    tokensOut: u1.tokensOut,
    output: searchPhase.text,
  });

  // Collect what the tool calls surfaced, to ground extraction.
  // In v7, result.toolResults accumulates across all steps.
  const gathered: string[] = [];
  for (const tr of searchPhase.toolResults ?? []) {
    const out = (tr as any).output ?? (tr as any).result;
    if (Array.isArray(out)) {
      for (const r of out) gathered.push(`- ${r.name} | ${r.url} | ${r.content}`);
    }
  }

  // Phase 2: structured extraction from gathered evidence.
  const extraction = await generateText({
    model: specialistLLM,
    output: Output.object({ schema: SpecialistOutputSchema }),
    system: `Extract competitive-intelligence findings for ${competitor} from the evidence below.
Rules: use only URLs present in the evidence; dedupe; set severity by threat to our business;
if nothing new/relevant, return an empty findings array.`,
    prompt: gathered.length
      ? `Evidence:\n${gathered.join("\n")}`
      : `No search evidence was gathered. Return empty findings.`,
  });
  const extractionOutput: SpecialistOutput = extraction.output;
  const u2 = usageTokens(extraction.usage);
  await tracer.span({
    parentId: specSpan,
    agent: channel,
    type: "score",
    label: `${channel} extraction`,
    model: config.specialistModel,
    tokensIn: u2.tokensIn,
    tokensOut: u2.tokensOut,
    output: `${extractionOutput.findings.length} findings`,
  });

  // Close the specialist span.
  await tracer.span({
    parentId,
    agent: channel,
    type: "specialist",
    label: `${brief.role} done · ${extractionOutput.findings.length} findings`,
    status: "ok",
    output: extractionOutput.notes,
  });

  return extractionOutput;
}
