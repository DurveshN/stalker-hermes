import { Webhooks } from "@dodopayments/nextjs";

// Dodo Payments webhook receiver.
// Verifies the signature with DODO_PAYMENTS_WEBHOOK_SECRET, then routes events.
//
// Behaviour:
//   405 – non-POST method
//   401 – invalid signature
//   400 – invalid payload
//   500 – internal error during verification
//
// Extend the granular handlers below to grant/revoke Pro access, send
// confirmation emails, or forward to Convex via the Worker.

import { NextRequest, NextResponse } from "next/server";

// Build the handler lazily so an empty secret at build time (page-data
// collection) doesn't crash the build. It's only required at request time.
let handler: ReturnType<typeof Webhooks> | null = null;

function getHandler() {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!webhookKey) return null;

  if (!handler) {
    handler = Webhooks({
      webhookKey,

      // Catch-all: fires for every verified event. Useful for logging/auditing.
      onPayload: async (payload) => {
        console.log("[dodo webhook]", payload.type);
      },

      // One-time payment completed.
      onPaymentSucceeded: async (payload) => {
        console.log("[dodo] payment succeeded", payload.data);
        // TODO: mark the associated signup/customer as paid.
      },

      // Subscription became active — grant Pro access.
      onSubscriptionActive: async (payload) => {
        console.log("[dodo] subscription active", payload.data);
        // TODO: unlock Pro features for payload.data.customer.
      },

      // Subscription renewed successfully.
      onSubscriptionRenewed: async (payload) => {
        console.log("[dodo] subscription renewed", payload.data);
      },

      // Subscription cancelled — revoke Pro access at period end.
      onSubscriptionCancelled: async (payload) => {
        console.log("[dodo] subscription cancelled", payload.data);
        // TODO: schedule downgrade to Beta.
      },

      // Subscription expired or failed — revoke access.
      onSubscriptionExpired: async (payload) => {
        console.log("[dodo] subscription expired", payload.data);
        // TODO: downgrade to Beta.
      },
      onSubscriptionFailed: async (payload) => {
        console.log("[dodo] subscription failed", payload.data);
      },
    });
  }
  return handler;
}

export async function POST(req: NextRequest) {
  const h = getHandler();
  if (!h) {
    return NextResponse.json(
      { error: "DODO_PAYMENTS_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }
  return h(req);
}
