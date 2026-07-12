import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Dodo redirects here after a completed payment. Query params include
// payment_id or subscription_id, status, email, and license_key (if any).
export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const subscriptionId =
    typeof params.subscription_id === "string"
      ? params.subscription_id
      : undefined;
  const paymentId =
    typeof params.payment_id === "string" ? params.payment_id : undefined;

  const ok = status ? status.toLowerCase() === "succeeded" || status.toLowerCase() === "active" : true;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        {ok ? "You're on Pro." : "Payment status pending"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {ok
          ? "Your subscription is active. Your competitor sweeps just leveled up — deep-search, unlimited tracking, and full run history are unlocked."
          : "We couldn't confirm the payment yet. If you were charged, it'll reconcile shortly."}
      </p>
      {(subscriptionId || paymentId) && (
        <p className="mt-4 text-xs text-muted-foreground">
          Reference: {subscriptionId ?? paymentId}
        </p>
      )}
      <Link href="/" className={buttonVariants({ className: "mt-8" })}>
        Back to home
      </Link>
    </main>
  );
}
