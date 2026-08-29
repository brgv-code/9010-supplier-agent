import { v } from "convex/values";
import { proposeOutreach } from "../src/match/proposeOutreach.js";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./lib";

export const listSuppliers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", userId))
      .take(200);
  },
});

export const addSupplier = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    categories: v.array(v.string()),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantId = await requireUserId(ctx);
    return await ctx.db.insert("suppliers", { tenantId, ...args, reliability: 0.7 });
  },
});

// Seeds a few electrical suppliers so matching has something to work with. Idempotent-ish:
// only seeds if the user has none.
export const seedSuppliers = mutation({
  args: {},
  handler: async (ctx) => {
    const tenantId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(1);
    if (existing.length > 0) return { seeded: 0 };

    const samples = [
      {
        name: "Sonepar",
        email: "angebot@sonepar.example",
        categories: ["Kabel", "Leitungen", "Installationsgeräte"],
        region: "Berlin",
        reliability: 0.9,
      },
      {
        name: "Rexel",
        email: "vertrieb@rexel.example",
        categories: ["Kabel", "Leitungen"],
        region: "Berlin",
        reliability: 0.75,
      },
      {
        name: "Hager Partner",
        email: "kontakt@hager-partner.example",
        categories: ["Verteilertechnik", "Verteiler"],
        region: "Berlin",
        reliability: 0.8,
      },
      {
        name: "Elektrogroßhandel Nord",
        email: "info@egh-nord.example",
        categories: ["Beleuchtung", "Leuchten", "Installationsgeräte"],
        region: "Berlin",
        reliability: 0.7,
      },
    ];
    for (const s of samples) {
      await ctx.db.insert("suppliers", { tenantId, ...s });
    }
    return { seeded: samples.length };
  },
});

// Rule-based match: pair each extracted material with matching suppliers, store as
// "proposed" outreach. Clears any prior proposal for the tender (idempotent re-run).
export const matchSuppliers = mutation({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) => {
    const tenantId = await requireUserId(ctx);
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== tenantId) throw new Error("tender not found");

    const materials = await ctx.db
      .query("materialReqs")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(2000);
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(200);

    const pairs = proposeOutreach(
      materials.map((m) => ({ id: m._id, category: m.category })),
      suppliers.map((s) => ({ id: s._id, categories: s.categories, reliability: s.reliability })),
    );

    // clear prior proposal
    const prior = await ctx.db
      .query("rfqItems")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(4000);
    for (const r of prior) await ctx.db.delete(r._id);

    for (const p of pairs) {
      await ctx.db.insert("rfqItems", {
        tenantId,
        tenderId: args.tenderId,
        supplierId: p.supplierId as Id<"suppliers">,
        materialReqId: p.materialId as Id<"materialReqs">,
        status: "proposed",
      });
    }
    await ctx.db.patch(args.tenderId, { status: "outreach_proposed" });
    return { pairs: pairs.length };
  },
});

// Returns the proposed outreach grouped by supplier, enriched with names + material descriptions.
export const listOutreach = query({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== userId) return [];

    const items = await ctx.db
      .query("rfqItems")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(4000);

    const groups = new Map<
      string,
      { supplierId: string; supplier: string; email: string; status: string; materials: string[] }
    >();
    for (const it of items) {
      const supplier = await ctx.db.get(it.supplierId);
      const material = await ctx.db.get(it.materialReqId);
      const key = it.supplierId;
      if (!groups.has(key)) {
        groups.set(key, {
          supplierId: it.supplierId,
          supplier: supplier?.name ?? "(unknown)",
          email: supplier?.email ?? "",
          status: it.status,
          materials: [],
        });
      }
      if (material) groups.get(key)?.materials.push(material.description);
    }
    return [...groups.values()];
  },
});

// Human curation: drop a supplier from the proposed outreach before sending.
export const removeOutreachSupplier = mutation({
  args: { tenderId: v.id("tenders"), supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    const tenantId = await requireUserId(ctx);
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== tenantId) throw new Error("tender not found");
    if (tender.status === "outreach_sent") throw new Error("already sent");

    const items = await ctx.db
      .query("rfqItems")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(4000);
    let removed = 0;
    for (const it of items) {
      if (it.supplierId === args.supplierId) {
        await ctx.db.delete(it._id);
        removed++;
      }
    }
    return { removed };
  },
});

export const approveOutreach = mutation({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) => {
    const tenantId = await requireUserId(ctx);
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== tenantId) throw new Error("tender not found");

    const items = await ctx.db
      .query("rfqItems")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(4000);
    for (const it of items) await ctx.db.patch(it._id, { status: "approved" });
    await ctx.db.patch(args.tenderId, { status: "outreach_approved" });
    return { approved: items.length };
  },
});
