import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignupForm } from "./signup-form";
import { ProCheckoutButton } from "./pro-checkout-button";

const TIERS = [
  {
    name: "Beta",
    price: "Free",
    note: "while we're in beta",
    features: [
      "Track up to 3 competitors",
      "All 6 channels",
      "Hourly + on-demand sweeps",
      "Telegram text + voice briefs",
      "Live observability dashboard",
    ],
    cta: "signup" as const,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    note: "per month",
    features: [
      "Unlimited competitors",
      "Deep-search mode",
      "Priority hourly cadence",
      "Full run history + export",
      "Regression evals & run diff",
    ],
    cta: "pro" as const,
    highlight: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Start free. Upgrade when it's watching your whole market.
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={`flex flex-col p-6 ${t.highlight ? "signal-glow border-signal/40" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t.name}</h3>
                {t.highlight && (
                  <Badge className="bg-signal text-signal-foreground">Most popular</Badge>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.note}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-signal" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {t.cta === "signup" ? (
                  <SignupForm compact />
                ) : (
                  <ProCheckoutButton />
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
