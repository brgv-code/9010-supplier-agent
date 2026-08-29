/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as extract from "../extract.js";
import type * as extractActions from "../extractActions.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as ingestActions from "../ingestActions.js";
import type * as ingestPdfActions from "../ingestPdfActions.js";
import type * as lib from "../lib.js";
import type * as rateLimit from "../rateLimit.js";
import type * as suppliers from "../suppliers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  extract: typeof extract;
  extractActions: typeof extractActions;
  http: typeof http;
  ingest: typeof ingest;
  ingestActions: typeof ingestActions;
  ingestPdfActions: typeof ingestPdfActions;
  lib: typeof lib;
  rateLimit: typeof rateLimit;
  suppliers: typeof suppliers;
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

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
