import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

// TODO(M6): derive from ctx.auth.getUserIdentity().tokenIdentifier instead of a constant.
const DEV_TENANT = "dev";

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

// Client asks for a signed URL, POSTs the raw .x83 to it, then calls the ingest action.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

// Commit a parsed tender + its positions in one transaction. Internal: only the ingest
// action calls it. Dedupes on the stored file's sha256 so re-uploading the same file is a no-op.
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
    const meta = await ctx.db.system.get("_storage", args.fileId);
    const sha256 = meta?.sha256 ?? "";

    const existing = await ctx.db
      .query("tenders")
      .withIndex("by_tenant_and_sha256", (q) =>
        q.eq("tenantId", DEV_TENANT).eq("x83Sha256", sha256),
      )
      .unique();
    if (existing) return existing._id;

    const tenderId = await ctx.db.insert("tenders", {
      tenantId: DEV_TENANT,
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
  handler: async (ctx) =>
    await ctx.db
      .query("tenders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", DEV_TENANT))
      .order("desc")
      .take(100),
});

export const listPositions = query({
  args: { tenderId: v.id("tenders") },
  // bounded for now; paginate in a later slice (a tender can have thousands of positions)
  handler: async (ctx, args) =>
    await ctx.db
      .query("positions")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(500),
});
