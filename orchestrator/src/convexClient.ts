import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { config } from "./config.js";

// Subscription client — used by the runQueue watcher in index.ts.
export const convexSub = new ConvexClient(config.convexUrl);

// HTTP client — used for one-shot mutations/queries during a run.
export const convex = new ConvexHttpClient(config.convexUrl);

// The generated API isn't available cross-workspace at build time, so we
// reference functions by string path via a thin typed-ish helper. Convex's
// clients accept a FunctionReference; we import the generated api from the
// convex-backend workspace which is resolvable at runtime.
export { api } from "../../convex-backend/convex/_generated/api.js";
