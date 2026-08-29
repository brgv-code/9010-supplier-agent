import { getAuthUserId } from "@convex-dev/auth/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

// The signed-in user id doubles as the tenant id. Derived server-side, never trusted from the client.
export async function requireUserId(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

// For read queries: return null (caller returns empty) instead of throwing when signed out.
export async function optionalUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<string | null> {
  return await getAuthUserId(ctx);
}
