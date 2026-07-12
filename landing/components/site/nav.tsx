import Link from "next/link";
import { Radar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Radar className="size-5 text-signal" />
          Stalker&nbsp;Hermes
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#agency" className="hover:text-foreground">The agency</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <a href="#get-access" className={buttonVariants({ size: "sm" })}>
          Get access
        </a>
      </div>
    </header>
  );
}
