import { Brain, Users, AtSign, Newspaper, FileText, Search, Package } from "lucide-react";
import { Card } from "@/components/ui/card";

const SPECIALISTS = [
  { icon: Users, name: "LinkedIn", beat: "posts · hiring · exec moves" },
  { icon: AtSign, name: "X / Twitter", beat: "launches · sentiment" },
  { icon: Newspaper, name: "News", beat: "press · funding · legal" },
  { icon: FileText, name: "Blog", beat: "changelogs · eng posts" },
  { icon: Search, name: "SEO / Site", beat: "pages · positioning" },
  { icon: Package, name: "Product", beat: "features · pricing" },
];

export function Agency() {
  return (
    <section id="agency" className="border-b bg-card/30 scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Run like an agency, staffed by agents
          </h2>
          <p className="mt-4 text-muted-foreground">
            A manager plans each sweep and delegates to specialists — then reviews their
            work and spawns deep-dive agents when a finding warrants it. Not one prompt
            pretending to be a team.
          </p>
        </div>

        <div className="mt-14 flex flex-col items-center">
          <Card className="signal-glow flex items-center gap-3 border-signal/30 px-5 py-3">
            <Brain className="size-5 text-signal" />
            <div className="text-left">
              <div className="font-medium">Manager agent</div>
              <div className="text-xs text-muted-foreground">
                plans · delegates · reviews · escalates
              </div>
            </div>
          </Card>

          <div className="h-8 w-px bg-border" />
          <div className="mb-8 font-mono text-xs text-muted-foreground">
            dispatches specialists
          </div>

          <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {SPECIALISTS.map((s) => (
              <Card
                key={s.name}
                className="flex flex-col gap-2 p-4 transition-colors hover:border-signal/40"
              >
                <s.icon className="size-5 text-signal" />
                <div className="text-sm font-medium">{s.name}</div>
                <div className="font-mono text-[11px] leading-tight text-muted-foreground">
                  {s.beat}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
