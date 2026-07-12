import { Checkout } from "@dodopayments/nextjs";

// Dodo Payments checkout route handler.
// - GET  (static):  /api/checkout?productId=pdt_xxx  -> { checkout_url }
// - POST (dynamic): body with product_id / billing / customer -> { checkout_url }
//
// Env required:
//   DODO_PAYMENTS_API_KEY       – secret API key
//   DODO_PAYMENTS_RETURN_URL    – where Dodo redirects after payment
//   DODO_PAYMENTS_ENVIRONMENT   – "test_mode" | "live_mode"

const environment =
  (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") ??
  "test_mode";

export const GET = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  returnUrl: process.env.DODO_PAYMENTS_RETURN_URL,
  environment,
  type: "static",
});

export const POST = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  returnUrl: process.env.DODO_PAYMENTS_RETURN_URL,
  environment,
  type: "dynamic",
});
