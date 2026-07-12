import { convex, api } from "./convexClient.js";
import { priorHashes } from "./db/postgres.js";
import type { Id } from "../../convex-backend/convex/_generated/dataModel.js";
import crypto from "node:crypto";

// Three memory layers the crew uses (Track 03 "handoffs & memory" L5):
//   1. NOW      — the current run's competitor + focus + tracker config
//   2. HISTORY  — this competitor's past findings (dedup + "what's changed")
//   3. RULES    — business rules: channels to track, severity threshold, caps
export interface Memory {
  now: {
    competitorId: Id<"competitors">;
    competitor: string;
    aliases: string[];
    domain?: string;
    linkedinUrl?: string;
    twitterHandle?: string;
    focus?: string;
  };
  history: {
    recentTitles: string[]; // recent finding titles → "what's new" grounding
    knownHashes: Set<string>; // cross-run dedup
  };
  rules: {
    channels: string[];
    depth: "fast" | "standard" | "deep";
    spendCapUsd: number;
    escalateAtSeverity: string;
    voiceBrief: boolean;
  };
}

export function dedupHash(competitor: string, url: string | undefined, title: string): string {
  const norm = `${competitor}|${(url ?? "").split("?")[0].toLowerCase()}|${title.toLowerCase().trim()}`;
  return crypto.createHash("sha1").update(norm).digest("hex");
}

export async function loadMemory(
  competitorId: Id<"competitors">,
  focus?: string,
): Promise<Memory> {
  const competitor = await convex.query(api.competitors.get, { id: competitorId });
  if (!competitor) throw new Error(`competitor ${competitorId} not found`);

  const tracker = await convex.query(api.trackers.forCompetitor, { competitorId });
  const recent = await convex.query(api.findings.forCompetitor, {
    competitorId,
    limit: 40,
  });
  const knownHashes = await priorHashes(competitor.name);
  for (const f of recent) knownHashes.add(f.dedupHash);

  return {
    now: {
      competitorId,
      competitor: competitor.name,
      aliases: competitor.aliases,
      domain: competitor.domain,
      linkedinUrl: competitor.linkedinUrl,
      twitterHandle: competitor.twitterHandle,
      focus,
    },
    history: {
      recentTitles: recent.map((f) => f.title),
      knownHashes,
    },
    rules: {
      channels: tracker?.channels ?? ["linkedin", "twitter", "news", "blog", "seo", "product"],
      depth: tracker?.depth ?? "standard",
      spendCapUsd: tracker?.spendCapUsd ?? 0.5,
      escalateAtSeverity: tracker?.escalateAtSeverity ?? "high",
      voiceBrief: tracker?.voiceBrief ?? true,
    },
  };
}
