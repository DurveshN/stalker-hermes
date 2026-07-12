"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Kicks off Dodo Payments checkout for the Pro plan.
// Calls the static checkout route (/api/checkout?productId=...) which returns
// a hosted checkout_url, then redirects the browser to it.
export function ProCheckoutButton() {
  const [loading, setLoading] = useState(false);
  const productId = process.env.NEXT_PUBLIC_DODO_PRODUCT_ID_PRO;

  async function goPro() {
    if (!productId) {
      toast.error("Checkout isn't configured yet — check back soon.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/checkout?productId=${encodeURIComponent(productId)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const { checkout_url } = (await res.json()) as { checkout_url: string };
      if (!checkout_url) throw new Error("no checkout url");
      window.location.href = checkout_url;
    } catch {
      toast.error("Couldn't start checkout — try again.");
      setLoading(false);
    }
  }

  return (
    <Button className="w-full" onClick={goPro} disabled={loading}>
      {loading ? "Starting checkout…" : "Go Pro"}
    </Button>
  );
}
