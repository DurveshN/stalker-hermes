/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actionItems from "../actionItems.js";
import type * as alerts from "../alerts.js";
import type * as competitors from "../competitors.js";
import type * as evals from "../evals.js";
import type * as feedback from "../feedback.js";
import type * as files from "../files.js";
import type * as findings from "../findings.js";
import type * as runQueue from "../runQueue.js";
import type * as runs from "../runs.js";
import type * as signups from "../signups.js";
import type * as traces from "../traces.js";
import type * as trackers from "../trackers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actionItems: typeof actionItems;
  alerts: typeof alerts;
  competitors: typeof competitors;
  evals: typeof evals;
  feedback: typeof feedback;
  files: typeof files;
  findings: typeof findings;
  runQueue: typeof runQueue;
  runs: typeof runs;
  signups: typeof signups;
  traces: typeof traces;
  trackers: typeof trackers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
