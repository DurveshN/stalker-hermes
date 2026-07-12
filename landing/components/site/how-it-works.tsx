import { FEATURES } from "@/lib/site-data";
import { Card } from "@/components/ui/card";

const STEPS = [
  {
    n: "01",
    title: "Name a competitor",
    body: "Add a company and domain. A tracker role is created automatically — tune which channels, how deep, spend caps and alert thresholds.",
  },
  {
    n: "02",
    title: "The crew goes to work",
    body: "Every hour the manager dispatches specialists across LinkedIn, X, news, blogs, SEO and product — searching live, deduping, threat-scoring.",
  },
  {
    n: "03",
    title: "You get briefed",
    body: "Only high-signal changes escalate — a text + voice brief on Telegram. Everything else waits in a dashboard that updates live.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          From zero to briefed in minutes
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="font-mono text-sm text-signal">{s.n}</div>
              <h3 className="mt-2 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6">
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
