import { Radar } from "lucide-react";
import { SignupForm } from "./signup-form";

export function Footer() {
  return (
    <footer className="mt-auto">
      <div className="border-b bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Stop finding out from a customer.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Put a crew of agents on your competitors today.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <SignupForm compact />
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <Radar className="size-4 text-signal" />
          <span>Stalker Hermes</span>
        </div>
        <div className="font-mono text-xs">
          Runs on Hermes · Linkup · Convex · Cloudflare · ElevenLabs
        </div>
      </div>
    </footer>
  );
}
