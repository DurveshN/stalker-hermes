"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignupForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      toast.success("You're on the list. First brief incoming.");
      setEmail("");
      setCompany("");
    } catch {
      toast.error("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
        {!compact && (
          <Input
            type="text"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="h-11 sm:max-w-[40%]"
          />
        )}
        <Button type="submit" disabled={loading} className="h-11 shrink-0 font-medium">
          {loading ? "…" : "Get early access"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Free while in beta. Track your first competitor in minutes.
      </p>
    </form>
  );
}
