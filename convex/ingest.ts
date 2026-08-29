import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./lib";

const positionValidator = v.object({
  oz: v.string(),
  shortText: v.string(),
  longText: v.string(),
  qty: v.union(v.number(), v.null()),
  unit: v.string(),
  kind: v.string(),
  sourceId: v.string(),
  // present only for PDF (LLM-extracted) positions; absent for deterministic GAEB parsing
  confidence: v.optional(v.number()),
});

// Client asks for a signed URL, POSTs the raw file to it, then calls the ingest action.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx); // must be signed in to upload
    return await ctx.storage.generateUploadUrl();
  },
});

// Commit a parsed tender + its positions in one transaction, scoped to the signed-in user.
// Internal: only the ingest actions call it. Dedupes on the stored file's sha256.
export const insertParsed = internalMutation({
  args: {
    fileId: v.id("_storage"),
    source: v.string(), // "gaeb" | "pdf"
    projectName: v.string(),
    phase: v.string(),
    gaebVersion: v.string(),
    currency: v.string(),
    positions: v.array(positionValidator),
  },
  handler: async (ctx, args): Promise<Id<"tenders">> => {
    const tenantId = await requireUserId(ctx);
    const meta = await ctx.db.system.get("_storage", args.fileId);
    const sha256 = meta?.sha256 ?? "";

    const existing = await ctx.db
      .query("tenders")
      .withIndex("by_tenant_and_sha256", (q) => q.eq("tenantId", tenantId).eq("x83Sha256", sha256))
      .unique();
    if (existing) return existing._id;

    const tenderId = await ctx.db.insert("tenders", {
      tenantId,
      source: args.source,
      projectName: args.projectName,
      phase: args.phase,
      gaebVersion: args.gaebVersion,
      currency: args.currency,
      x83Sha256: sha256,
      fileId: args.fileId,
      status: "parsed",
      positionCount: args.positions.length,
    });
    for (const p of args.positions) {
      await ctx.db.insert("positions", { tenderId, ...p });
    }
    return tenderId;
  },
});

export const listTenders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("tenders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", userId))
      .order("desc")
      .take(100);
  },
});

export const listPositions = query({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== userId) return []; // not yours
    return await ctx.db
      .query("positions")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(500);
  },
});
