// Edit these after deploying the Worker + creating your Dodo product.
window.STALKER_CONFIG = {
  // Cloudflare Worker base URL (from `wrangler deploy`).
  WORKER_URL: "https://stalker-hermes-worker.<your-subdomain>.workers.dev",
  // Dodo Payments hosted checkout / payment-link URL for the Pro plan.
  DODO_CHECKOUT_URL: "https://checkout.dodopayments.com/buy/<your-product-id>",
};
