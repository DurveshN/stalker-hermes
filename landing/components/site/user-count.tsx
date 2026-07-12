"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convexApi";

// Live, reactive signup count — ticks up in real time as people join.
export function UserCount({ className = "" }: { className?: string }) {
  const stats = useQuery(api.signups.stats, {});
  const n = stats?.total ?? 0;
  return (
    <span className={className}>
      <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-signal align-middle" />
      <b className="text-foreground">{n.toLocaleString()}</b> {n === 1 ? "builder" : "builders"} onboarded
    </span>
  );
}
