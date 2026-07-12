// Re-export the Convex generated API + types so views import from one place.
// Resolves after `npx convex dev`/`codegen` generates these files.
export { api } from "../../convex-backend/convex/_generated/api.js";
export type { Id, Doc } from "../../convex-backend/convex/_generated/dataModel.js";
