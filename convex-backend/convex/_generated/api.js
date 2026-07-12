// FALLBACK — overwritten by `npx convex dev`/`convex codegen`.
// Uses anyApi so clients resolve functions by string path at runtime even
// before codegen has run. Codegen replaces this with typed references.
import { anyApi } from "convex/server";
export const api = anyApi;
export const internal = anyApi;
