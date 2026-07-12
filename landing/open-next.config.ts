import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal OpenNext config. Incremental caching (R2/KV) can be added later;
// the landing page is mostly static + a few dynamic API routes, so the
// default config is enough to deploy.
export default defineCloudflareConfig({});
