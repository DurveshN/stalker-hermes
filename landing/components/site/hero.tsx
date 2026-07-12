import { Badge } from "@/components/ui/badge";
import { IntelFeed } from "./intel-feed";
import { SignupForm } from "./signup-form";
import { AuthDialog } from "./auth-dialog";
import { UserCount } from "./user-count";
import { buttonVariants } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="pointer-events-none absolute inset-0 bg-grid radial-fade opacity-[0.5]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
        <div className="flex flex-col justify-center">
          <Badge
            variant="outline"
            className="w-fit gap-1.5 border-signal/30 bg-signal/10 text-signal"
          >
            <span className="live-dot inline-block size-1.5 rounded-full bg-signal" />
            AI competitive-intelligence agency
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Your competitor made a move.
            <span className="block text-signal">You already know.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Stalker Hermes runs a crew of AI agents that track every competitor across
            LinkedIn, X, news, blogs and SEO — every hour, automatically. The moment
            something matters, you get a briefing on Telegram. Text and voice.
          </p>
          <div id="get-access" className="mt-8 flex max-w-xl flex-wrap items-center gap-3 scroll-mt-24">
            <AuthDialog
              defaultMode="signup"
              trigger={
                <button className={buttonVariants({ size: "lg" })}>Create free account →</button>
              }
            />
            <AuthDialog
              defaultMode="signin"
              trigger={
                <button className={buttonVariants({ size: "lg", variant: "outline" })}>
                  Sign in
                </button>
              }
            />
          </div>
          <div className="mt-4">
            <UserCount className="text-sm text-muted-foreground" />
          </div>
          <div className="mt-4 max-w-xl">
            <p className="mb-2 text-xs text-muted-foreground">Or just drop your email:</p>
            <SignupForm />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
            <span>◦ hourly + on-demand</span>
            <span>◦ every finding sourced</span>
            <span>◦ threat-scored, deduped</span>
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full">
            <IntelFeed />
            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
              illustrative feed — your competitors, live
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
