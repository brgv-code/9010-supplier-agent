import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// No auth yet, so this is a GLOBAL cap: it bounds how often the public AI endpoints
// (material extraction, PDF ingest) can spend on OpenAI. Once auth lands, key these
// per authenticated user/tenant instead of a single "global" key.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  aiRequest: { kind: "fixed window", rate: 40, period: HOUR },
});

// Consumes one token; throws if the hourly budget is exhausted.
export const consumeAiBudget = internalMutation({
  args: {},
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, "aiRequest", { key: "global", throws: true });
  },
});
