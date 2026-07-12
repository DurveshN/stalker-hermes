import { convex, api } from "./convexClient.js";
import type { Id } from "../../convex-backend/convex/_generated/dataModel.js";
import { config } from "./config.js";
import { Tracer } from "./trace.js";
import { loadMemory, dedupHash } from "./memory.js";
import { runManager } from "./agents/manager.js";
import { saveFindingHistory, saveRunCost, saveSeoSnapshot } from "./db/postgres.js";
import { SEVERITIES } from "./agents/types.js";
import { synthesizeVoice, uploadVoiceToConvex } from "./voice.js";
import { sendText, sendVoiceNote } from "./escalate.js";

const sevRank = (s: string) => SEVERITIES.indexOf(s as any);

export interface RunOutcome {
  runId: Id<"runs">;
  findings: number;
  newFindings: number;
  escalations: number;
}

// Execute one full tracking cycle for one competitor.
export async function runCrew(args: {
  competitorId: Id<"competitors">;
  trigger: string;
  focus?: string;
}): Promise<RunOutcome> {
  const memory = await loadMemory(args.competitorId, args.focus);
  const { competitor } = memory.now;

  const runId = await convex.mutation(api.runs.start, {
    competitorId: args.competitorId,
    competitorName: competitor,
    trigger: args.trigger,
    plannedChannels: memory.rules.channels,
    version: config.version,
  });
  const runIdStr = runId as unknown as string;
  const tracer = new Tracer(runId);

  let status: "succeeded" | "partial" | "failed" = "succeeded";
  let newCount = 0;
  let escalations = 0;
  let brief = "";

  try {
    const result = await runManager({ memory, tracer, runIdStr });
    brief = result.brief;

    // Persist findings: dedup (memory + Convex hash index), dual-write.
    const persisted: {
      id: Id<"findings">;
      isNew: boolean;
      title: string;
      severity: string;
      url?: string;
      category: string;
    }[] = [];

    for (const f of result.findings) {
      const hash = dedupHash(competitor, f.url, f.title);
      if (memory.history.knownHashes.has(hash)) continue;
      memory.history.knownHashes.add(hash);

      const channel = ["linkedin", "twitter", "news", "blog", "seo", "product"].includes(
        f.channel,
      )
        ? (f.channel as any)
        : "product"; // dynamic sub-specialist channels fold into "product"

      const { id, isNew } = await convex.mutation(api.findings.upsert, {
        runId,
        competitorId: args.competitorId,
        channel,
        title: f.title,
        url: f.url || undefined,
        summary: f.summary,
        category: f.category,
        severity: f.severity,
        relevance: f.relevance,
        dedupHash: hash,
        publishedAt: f.publishedAt,
      });
      if (isNew) {
        newCount++;
        await saveFindingHistory({
          runId: runIdStr,
          competitor,
          channel: f.channel,
          title: f.title,
          url: f.url || undefined,
          summary: f.summary,
          category: f.category,
          severity: f.severity,
          relevance: f.relevance,
          dedupHash: hash,
          publishedAt: f.publishedAt,
        });
        if (f.channel === "seo") {
          await saveSeoSnapshot({
            competitor,
            domain: memory.now.domain,
            snapshot: { title: f.title, url: f.url, summary: f.summary, ts: Date.now() },
          });
        }
      }
      persisted.push({ id, isNew, title: f.title, severity: f.severity, url: f.url, category: f.category });
    }

    // ---- Escalate by exception: only findings >= threshold ----------------
    const threshold = memory.rules.escalateAtSeverity;
    const escalate = persisted.filter(
      (p) => p.isNew && sevRank(p.severity) >= sevRank(threshold),
    );

    if (escalate.length) {
      const header = `🕵️ *Stalker Hermes* — ${competitor}\n${escalate.length} high-signal update(s):`;
      const lines = escalate
        .map((e) => `• *${e.severity.toUpperCase()}* [${e.category}] ${e.title}${e.url ? `\n  ${e.url}` : ""}`)
        .join("\n");
      const body = `${header}\n${lines}\n\n${brief.slice(0, 1500)}`;
      const via: string[] = [];
      if (await sendText(body)) via.push("telegram");

      // Voice brief (ElevenLabs → Telegram audio + durable Convex URL).
      let voiceUrl: string | undefined;
      if (memory.rules.voiceBrief) {
        const spoken = `Competitive intelligence update on ${competitor}. ${brief}`;
        const audio = await synthesizeVoice(spoken);
        if (audio) {
          voiceUrl = (await uploadVoiceToConvex(audio)) ?? undefined;
          if (await sendVoiceNote(audio, `Intel brief — ${competitor}`)) via.push("voice");
          await tracer.span({
            agent: "manager",
            type: "escalation",
            label: `Voice brief delivered for ${competitor}`,
            status: "ok",
          });
        }
      }

      for (const e of escalate) {
        await convex.mutation(api.alerts.create, {
          runId,
          competitorId: args.competitorId,
          findingId: e.id,
          severity: e.severity as any,
          message: e.title,
          deliveredVia: via,
          voiceUrl,
        });
      }
      escalations = escalate.length;
    }

    if (tracer.totalCostUsd >= memory.rules.spendCapUsd) status = "partial";
  } catch (e) {
    status = "failed";
    await convex.mutation(api.runs.finish, {
      id: runId,
      status: "failed",
      totalTokensIn: tracer.totalTokensIn,
      totalTokensOut: tracer.totalTokensOut,
      totalCostUsd: tracer.totalCostUsd,
      findingsCount: 0,
      newFindingsCount: 0,
      escalations: 0,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }

  await convex.mutation(api.runs.finish, {
    id: runId,
    status,
    totalTokensIn: tracer.totalTokensIn,
    totalTokensOut: tracer.totalTokensOut,
    totalCostUsd: tracer.totalCostUsd,
    findingsCount: newCount, // count of items surfaced this run (new)
    newFindingsCount: newCount,
    escalations,
    summary: brief.slice(0, 2000),
  });

  await saveRunCost({
    runId: runIdStr,
    competitor,
    tokensIn: tracer.totalTokensIn,
    tokensOut: tracer.totalTokensOut,
    costUsd: tracer.totalCostUsd,
    latencyMs: 0,
  });

  return { runId, findings: newCount, newFindings: newCount, escalations };
}
