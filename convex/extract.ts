import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const materialReqValidator = v.object({
  positionId: v.id("positions"),
  description: v.string(),
  qty: v.union(v.number(), v.null()),
  unit: v.string(),
  category: v.string(),
  confidence: v.number(),
});

// Feeds the extraction action. Bounded; a real thousands-position tender would paginate.
export const positionsForTender = internalQuery({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("positions")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(2000),
});

// Idempotent: clears prior material reqs for the tender, then writes the new set.
// TODO(scale): batch the clear/insert for very large tenders (transaction limits).
export const replaceMaterialReqs = internalMutation({
  args: { tenderId: v.id("tenders"), reqs: v.array(materialReqValidator) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("materialReqs")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(4000);
    for (const r of existing) await ctx.db.delete(r._id);
    for (const r of args.reqs) {
      await ctx.db.insert("materialReqs", { tenderId: args.tenderId, ...r });
    }
    await ctx.db.patch(args.tenderId, { status: "extracted" });
  },
});

export const listMaterialReqs = query({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("materialReqs")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(2000),
});
