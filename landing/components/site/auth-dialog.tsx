"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convexApi";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Mode = "signup" | "signin";

const SLACK_INVITE = process.env.NEXT_PUBLIC_SLACK_INVITE_URL || "";

export function AuthDialog({
  trigger,
  defaultMode = "signup",
}: {
  trigger: React.ReactElement;
  defaultMode?: Mode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [joined, setJoined] = useState(false);
  const register = useAction(api.signups.register);
  const signin = useAction(api.signups.signin);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) setJoined(false); // clear success state when dialog closes
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        {joined ? (
          <div className="text-center">
            <DialogHeader>
              <DialogTitle>🎉 You&apos;re in.</DialogTitle>
              <DialogDescription>
                Last step — join our Slack to talk to the agent and get your competitor
                briefs. It runs entirely in Slack.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-3">
              {SLACK_INVITE ? (
                <a
                  href={SLACK_INVITE}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ size: "lg" }) + " w-full"}
                >
                  Join our Slack →
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A Slack invite is on its way to your email.
                </p>
              )}
              <button
                onClick={() => reset(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to Stalker Hermes</DialogTitle>
              <DialogDescription>
                Create an account to put a crew of agents on your competitors.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
              </TabsList>
              <TabsContent value="signup">
                <AuthForm
                  cta="Create account"
                  withCompany
                  onSubmit={async ({ email, password, company }) => {
                    await register({ email, password, company: company || undefined });
                    toast.success("Account created — you're in.");
                    setJoined(true); // show the Join-Slack step
                  }}
                />
              </TabsContent>
              <TabsContent value="signin">
                <AuthForm
                  cta="Sign in"
                  onSubmit={async ({ email, password }) => {
                    await signin({ email, password });
                    toast.success("Signed in.");
                    setJoined(true);
                  }}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuthForm({
  cta,
  withCompany = false,
  onSubmit,
}: {
  cta: string;
  withCompany?: boolean;
  onSubmit: (v: { email: string; password: string; company: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ email, password, company });
      try {
        localStorage.setItem("stalker_user", email.trim().toLowerCase());
      } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required placeholder="you@company.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {withCompany && (
        <div className="space-y-1.5">
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required minLength={6} placeholder="min 6 characters"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "…" : cta}
      </Button>
    </form>
  );
}

export { buttonVariants };
