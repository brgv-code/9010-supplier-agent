import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./lib";

// The materials asked of the supplier on a given outbound email, in a stable order (so the
// quote-parser's 1-based indices map back to real records).
export const materialsForEmail = internalQuery({
  args: { emailId: v.id("outboundEmails") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.tenantId !== userId) throw new Error("email not found");

    const items = await ctx.db
      .query("rfqItems")
      .withIndex("by_tender", (q) => q.eq("tenderId", email.tenderId))
      .take(4000);
    const forSupplier = items.filter((it) => it.supplierId === email.supplierId);

    const materials: { id: Id<"materialReqs">; description: string }[] = [];
    for (const it of forSupplier) {
      const m = await ctx.db.get(it.materialReqId);
      if (m) materials.push({ id: m._id, description: m.description });
    }
    return { tenderId: email.tenderId, supplierId: email.supplierId, materials };
  },
});

const quoteValidator = v.object({
  materialReqId: v.id("materialReqs"),
  unitPrice: v.number(),
  moq: v.union(v.number(), v.null()),
  leadTimeDays: v.union(v.number(), v.null()),
  confidence: v.number(),
});

// Stores parsed quotes, marks the email replied, and flips the tender to "ready_to_calculate"
// once every material has at least one quote.
export const storeQuotes = internalMutation({
  args: { emailId: v.id("outboundEmails"), quotes: v.array(quoteValidator) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.tenantId !== userId) throw new Error("email not found");

    for (const qt of args.quotes) {
      await ctx.db.insert("quotes", {
        tenantId: userId,
        tenderId: email.tenderId,
        supplierId: email.supplierId,
        materialReqId: qt.materialReqId,
        unitPrice: qt.unitPrice,
        moq: qt.moq,
        leadTimeDays: qt.leadTimeDays,
        confidence: qt.confidence,
      });
    }
    await ctx.db.patch(args.emailId, { status: "replied" });

    // completeness: every material has >= 1 quote?
    const materials = await ctx.db
      .query("materialReqs")
      .withIndex("by_tender", (q) => q.eq("tenderId", email.tenderId))
      .take(4000);
    const quoted = await ctx.db
      .query("quotes")
      .withIndex("by_tender", (q) => q.eq("tenderId", email.tenderId))
      .take(8000);
    const quotedIds = new Set(quoted.map((x) => x.materialReqId));
    const complete = materials.length > 0 && materials.every((m) => quotedIds.has(m._id));
    if (complete) {
      await ctx.db.patch(email.tenderId, { status: "ready_to_calculate" });
    }
    return { stored: args.quotes.length, complete };
  },
});

export const listQuotes = query({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== userId) return [];

    const rows = await ctx.db
      .query("quotes")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(4000);

    const out: {
      _id: Id<"quotes">;
      supplier: string;
      material: string;
      unitPrice: number;
      moq: number | null;
      leadTimeDays: number | null;
      confidence: number;
    }[] = [];
    for (const r of rows) {
      const supplier = await ctx.db.get(r.supplierId);
      const material = await ctx.db.get(r.materialReqId);
      out.push({
        _id: r._id,
        supplier: supplier?.name ?? "(unknown)",
        material: material?.description ?? "(unknown)",
        unitPrice: r.unitPrice,
        moq: r.moq,
        leadTimeDays: r.leadTimeDays,
        confidence: r.confidence,
      });
    }
    return out;
  },
});
