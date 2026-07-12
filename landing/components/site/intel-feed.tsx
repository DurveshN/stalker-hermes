"use client";

import { useEffect, useState } from "react";
import { DEMO_FEED, SEVERITY_STYLES, type FeedItem } from "@/lib/site-data";
import { cn } from "@/lib/utils";

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X",
  news: "News",
  blog: "Blog",
  seo: "SEO",
  product: "Product",
};

// A faux-live intel feed: items stream in on an interval so the hero shows the
// product doing its job rather than a static screenshot.
export function IntelFeed() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => (c >= DEMO_FEED.length ? 3 : c + 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const items = DEMO_FEED.slice(0, count);

  return (
    <div className="signal-glow rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="live-dot inline-block size-2 rounded-full bg-signal" />
          LIVE · competitor feed
        </div>
        <div className="font-mono text-xs text-muted-foreground">3 competitors · 6 channels</div>
      </div>
      <div className="divide-y">
        {[...items].reverse().map((item, i) => (
          <FeedRow key={`${item.title}-${count}`} item={item} isNew={i === 0} />
        ))}
      </div>
    </div>
  );
}

function FeedRow({ item, isNew }: { item: FeedItem; isNew: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors",
        isNew && "bg-signal/[0.06]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
          SEVERITY_STYLES[item.severity],
        )}
      >
        {item.severity}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{item.competitor}</span>
          <span>·</span>
          <span className="font-mono">{CHANNEL_LABEL[item.channel] ?? item.channel}</span>
          <span>·</span>
          <span>{item.category}</span>
        </div>
        <p className="mt-0.5 truncate text-sm">{item.title}</p>
      </div>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{item.ago}</span>
    </div>
  );
}
