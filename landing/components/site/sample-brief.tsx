import { Play, Send } from "lucide-react";

export function SampleBrief() {
  return (
    <section className="border-b bg-card/30">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            The brief lands where you already are
          </h2>
          <p className="mt-4 text-muted-foreground">
            No new dashboard to babysit. When something material happens, Stalker Hermes
            messages you on Telegram with a tight, sourced brief — and a voice note you
            can listen to between meetings.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Exception-based — only what crosses your threshold",
              "Every claim links to its source",
              "Text for skimming, voice for the walk to your next call",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
                <span className="text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Telegram-style brief */}
        <div className="mx-auto w-full max-w-md rounded-2xl border bg-background p-4 shadow-xl">
          <div className="flex items-center gap-2 border-b pb-3">
            <div className="grid size-8 place-items-center rounded-full bg-signal/15 text-signal">
              <Send className="size-4" />
            </div>
            <div className="text-sm font-medium">Stalker Hermes</div>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">now</span>
          </div>
          <div className="space-y-3 pt-3 text-sm">
            <div className="rounded-lg rounded-tl-sm bg-muted/60 p-3">
              <div className="font-medium text-signal">🕵️ Northwind AI — 2 high-signal updates</div>
              <p className="mt-2 text-muted-foreground">
                <span className="text-foreground">• CRITICAL [funding]</span> Raised $40M
                Series B (Accel). Messaging shifting up-market toward enterprise.
              </p>
              <p className="mt-1.5 text-muted-foreground">
                <span className="text-foreground">• HIGH [product]</span> Snowflake
                integration in private beta — overlaps our data-warehouse story.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Recommend: revisit enterprise pricing page this week.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg rounded-tl-sm bg-muted/60 p-3">
              <button className="grid size-9 shrink-0 place-items-center rounded-full bg-signal text-signal-foreground">
                <Play className="size-4 fill-current" />
              </button>
              <div className="h-6 flex-1 items-center">
                <div className="flex h-full items-center gap-0.5">
                  {[6, 12, 20, 14, 8, 16, 22, 10, 18, 7, 13, 24, 9, 15, 11, 19, 6, 14].map(
                    (h, i) => (
                      <span
                        key={i}
                        className="w-0.5 rounded-full bg-signal/60"
                        style={{ height: `${h}px` }}
                      />
                    ),
                  )}
                </div>
              </div>
              <span className="font-mono text-xs text-muted-foreground">0:38</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
