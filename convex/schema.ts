import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// M0 data model. tenantId is present from day one (enforcement/auth comes in M6);
// positions live in their own table (a tender can have thousands, so never an array field).
export default defineSchema({
  tenders: defineTable({
    tenantId: v.string(),
    projectName: v.string(),
    phase: v.string(),
    gaebVersion: v.string(),
    currency: v.string(),
    x83Sha256: v.string(), // from _storage metadata; used to dedupe re-uploads
    fileId: v.id("_storage"),
    status: v.string(),
    positionCount: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_sha256", ["tenantId", "x83Sha256"]),

  positions: defineTable({
    tenderId: v.id("tenders"),
    oz: v.string(),
    shortText: v.string(),
    longText: v.string(),
    qty: v.union(v.number(), v.null()),
    unit: v.string(),
    kind: v.string(),
    sourceId: v.string(),
  }).index("by_tender", ["tenderId"]),
});
