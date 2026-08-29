import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// tenantId = the signed-in user's id (Convex Auth). Positions live in their own table
// (a tender can have thousands, so never an array field).
export default defineSchema({
  ...authTables,
  tenders: defineTable({
    tenantId: v.string(),
    source: v.optional(v.string()), // "gaeb" | "pdf" (optional so pre-existing rows validate)
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
    confidence: v.optional(v.number()), // set for PDF (LLM-extracted) positions only
  }).index("by_tender", ["tenderId"]),

  // M1: material needs extracted from positions by the Mastra agent (model-driven step).
  materialReqs: defineTable({
    tenderId: v.id("tenders"),
    positionId: v.id("positions"),
    description: v.string(),
    qty: v.union(v.number(), v.null()),
    unit: v.string(),
    category: v.string(),
    confidence: v.number(),
  })
    .index("by_tender", ["tenderId"])
    .index("by_position", ["positionId"]),

  // M2: the supplier catalog (per user) and the proposed/approved outreach.
  suppliers: defineTable({
    tenantId: v.string(),
    name: v.string(),
    email: v.string(),
    categories: v.array(v.string()),
    region: v.string(),
    reliability: v.number(), // 0..1
  }).index("by_tenant", ["tenantId"]),

  rfqItems: defineTable({
    tenantId: v.string(),
    tenderId: v.id("tenders"),
    supplierId: v.id("suppliers"),
    materialReqId: v.id("materialReqs"),
    status: v.string(), // "proposed" | "approved"
  }).index("by_tender", ["tenderId"]),

  // M3: one rendered RFQ email per supplier, with tracked status. Sending is simulated
  // for now (swap in the Convex Resend component for real delivery).
  outboundEmails: defineTable({
    tenantId: v.string(),
    tenderId: v.id("tenders"),
    supplierId: v.id("suppliers"),
    supplierName: v.string(),
    email: v.string(),
    subject: v.string(),
    body: v.string(),
    status: v.string(), // "sent" | "reminded" | "replied" (M4) | "bounced"
    sentAt: v.number(),
  }).index("by_tender", ["tenderId"]),
});
