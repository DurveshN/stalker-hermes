"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convexApi";

function ago(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Live "recently joined" list — emails are masked server-side (no PII).
export function RecentSignups() {
  const rows = useQuery(api.signups.recentPublic, { limit: 8 });
  if (!rows || rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card/60 p-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="live-dot inline-block size-1.5 rounded-full bg-signal" />
        recently joined
      </div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="font-mono text-foreground">
              {r.email}
              {r.company ? <span className="text-muted-foreground"> · {r.company}</span> : null}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {r.plan === "pro" ? "PRO · " : ""}
              {ago(r.ts)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
