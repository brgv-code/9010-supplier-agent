"use node";

import { v } from "convex/values";
import { extractQuotes } from "../src/ai/quoteParser.js";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireUserId } from "./lib";

// Ingests a supplier reply: parse prices (Mastra) and store them against the materials.
// In production this is what the inbound-email webhook (Convex HTTP action) would call;
// here it is triggered by the "simulate reply" UI. Node runtime + OpenAI, so it is rate-limited.
export const ingestReply = action({
  args: { emailId: v.id("outboundEmails"), replyText: v.string() },
  handler: async (ctx, args): Promise<{ stored: number; complete: boolean }> => {
    await requireUserId(ctx);
    await ctx.runMutation(internal.rateLimit.consumeAiBudget, {});

    const { materials } = await ctx.runQuery(internal.quotes.materialsForEmail, {
      emailId: args.emailId,
    });
    if (materials.length === 0) return { stored: 0, complete: false };

    const parsed = await extractQuotes(
      args.replyText,
      materials.map((m) => ({ description: m.description })),
    );

    const quotes = [];
    for (const p of parsed) {
      const material = materials[p.materialIndex - 1];
      if (!material) continue; // index out of range -> skip
      quotes.push({
        materialReqId: material.id,
        unitPrice: p.unitPrice,
        moq: p.moq,
        leadTimeDays: p.leadTimeDays,
        confidence: p.confidence,
      });
    }

    return await ctx.runMutation(internal.quotes.storeQuotes, {
      emailId: args.emailId,
      quotes,
    });
  },
});
