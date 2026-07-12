import { generateText, tool, isStepCount, Output } from "ai";
import { z } from "zod";
import { specialistLLM, usageTokens } from "../llm.js";
import { config } from "../config.js";
import { linkupSearchResults } from "../linkup.js";
import { saveRawSearch } from "../db/postgres.js";
import type { Tracer } from "../trace.js";
import type { Memory } from "../memory.js";
import type { Id } from "../../../convex-backend/convex/_generated/dataModel.js";
import { SpecialistOutputSchema, type SpecialistOutput } from "./types.js";

// A sub-specialist is a role the MANAGER spawns on the fly (emergent org, L5):
// e.g. after a "funding" finding it spawns a "funding-deep-dive" agent with a
// role + focus that did not exist at run kickoff.
export async function runSubSpecialist(args: {
  roleName: string; // dynamic, manager-authored (e.g. "funding-deep-dive")
  focus: string; // what to investigate
  memory: Memory;
  tracer: Tracer;
  parentId: Id<"traces">;
  runIdStr: string;
}): Promise<SpecialistOutput> {
  const { roleName, focus, memory, tracer, parentId, runIdStr } = args;
  const { competitor } = memory.now;

  const span = await tracer.span({
    parentId,
    agent: roleName,
    type: "subspecialist",
    label: `spawned: ${roleName} · ${focus.slice(0, 50)}`,
    status: "running",
    input: { roleName, focus },
  });

  const linkup_search = tool({
    description: "Deep web search via Linkup to investigate a specific development.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      const { results, raw } = await linkupSearchResults(query, "deep", { maxResults: 6 });
      await saveRawSearch({ runId: runIdStr, competitor, channel: roleName, depth: "deep", query, response: raw });
      await tracer.span({
        parentId: span,
        agent: roleName,
        type: "linkup_query",
        label: `deep: ${query.slice(0, 55)}`,
        output: results.map((r) => r.url).join("\n"),
      });
      return results;
    },
  });

  const research = await generateText({
    model: specialistLLM,
    system: `You are a "${roleName}" specialist spawned to deeply investigate one development about ${competitor}.
Investigate: ${focus}. Run up to 2 deep searches, then stop.`,
    prompt: `Investigate now and gather corroborating sources.`,
    tools: { linkup_search },
    stopWhen: isStepCount(4),
  });
  const u1 = usageTokens(research.usage);
  await tracer.span({
    parentId: span,
    agent: roleName,
    type: "llm_call",
    label: `${roleName} reasoning`,
    model: config.specialistModel,
    tokensIn: u1.tokensIn,
    tokensOut: u1.tokensOut,
  });

  const gathered: string[] = [];
  for (const tr of research.toolResults ?? []) {
    const out = (tr as any).output ?? (tr as any).result;
    if (Array.isArray(out)) for (const r of out) gathered.push(`- ${r.name} | ${r.url} | ${r.content}`);
  }

  const extraction = await generateText({
    model: specialistLLM,
    output: Output.object({ schema: SpecialistOutputSchema }),
    system: `Summarize the deep-dive on ${competitor} (${focus}) as findings. Use only URLs in the evidence.`,
    prompt: gathered.length ? `Evidence:\n${gathered.join("\n")}` : "No evidence. Return empty findings.",
  });
  const result: SpecialistOutput = extraction.output;
  const u2 = usageTokens(extraction.usage);
  await tracer.span({
    parentId: span,
    agent: roleName,
    type: "synthesis",
    label: `${roleName} → ${result.findings.length} findings`,
    model: config.specialistModel,
    tokensIn: u2.tokensIn,
    tokensOut: u2.tokensOut,
    status: "ok",
  });

  return result;
}
