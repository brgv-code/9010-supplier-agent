import { v } from "convex/values";
import { renderRfq } from "../src/email/renderRfq.js";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./lib";

// Demo: short so the reminder is visible live. Production would be ~48h.
const REMINDER_MS = 20_000;

// Renders + "sends" an RFQ per supplier (simulated: records the email, schedules a reminder).
// Durable via ctx.scheduler (survives restarts). Swap the record step for the Convex Resend
// component to deliver real mail. Requires the outreach to be approved (the human gate).
export const sendOutreach = mutation({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) => {
    const tenantId = await requireUserId(ctx);
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== tenantId) throw new Error("tender not found");
    if (tender.status !== "outreach_approved") {
      throw new Error("approve the outreach before sending");
    }

    const items = await ctx.db
      .query("rfqItems")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(4000);

    // group materials per supplier
    const bySupplier = new Map<Id<"suppliers">, string[]>();
    const materialCache = new Map<Id<"materialReqs">, string>();
    for (const it of items) {
      let desc = materialCache.get(it.materialReqId);
      if (desc === undefined) {
        const m = await ctx.db.get(it.materialReqId);
        desc = m?.description ?? "";
        materialCache.set(it.materialReqId, desc);
      }
      const list = bySupplier.get(it.supplierId) ?? [];
      list.push(desc);
      bySupplier.set(it.supplierId, list);
    }

    let sent = 0;
    for (const [supplierId, descriptions] of bySupplier) {
      const supplier = await ctx.db.get(supplierId);
      if (!supplier) continue;
      const { subject, body } = renderRfq({
        supplierName: supplier.name,
        projectName: tender.projectName,
        materials: descriptions.map((d) => ({ description: d, qty: null, unit: "" })),
      });
      const emailId = await ctx.db.insert("outboundEmails", {
        tenantId,
        tenderId: args.tenderId,
        supplierId,
        supplierName: supplier.name,
        email: supplier.email,
        subject,
        body,
        status: "sent",
        sentAt: Date.now(),
      });
      // durable reminder: flip to "reminded" if still unanswered
      await ctx.scheduler.runAfter(REMINDER_MS, internal.outreach.sendReminder, { emailId });
      sent++;
    }

    await ctx.db.patch(args.tenderId, { status: "outreach_sent" });
    return { sent };
  },
});

export const sendReminder = internalMutation({
  args: { emailId: v.id("outboundEmails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (email && email.status === "sent") {
      await ctx.db.patch(args.emailId, { status: "reminded" });
    }
  },
});

export const listOutboundEmails = query({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const tender = await ctx.db.get(args.tenderId);
    if (!tender || tender.tenantId !== userId) return [];
    return await ctx.db
      .query("outboundEmails")
      .withIndex("by_tender", (q) => q.eq("tenderId", args.tenderId))
      .take(2000);
  },
});
