"use node";

import { v } from "convex/values";
import { extractPositionMaterials } from "../src/ai/materialExtractor.js";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { requireUserId } from "./lib";

type ReqRow = {
  positionId: Id<"positions">;
  description: string;
  qty: number | null;
  unit: string;
  category: string;
  confidence: number;
};

// Runs the Mastra material-extractor over every position of a tender and stores the results.
// Node runtime (Mastra + ai-sdk). Needs OPENAI_API_KEY set in the Convex deployment env.
// M1: sequential per position; parallelise / batch in a later slice.
export const extractMaterialsForTender = action({
  args: { tenderId: v.id("tenders") },
  handler: async (ctx, args): Promise<{ positions: number; materials: number }> => {
    await requireUserId(ctx); // must be signed in
    // Gate OpenAI spend on this public endpoint (throws if the hourly budget is spent).
    await ctx.runMutation(internal.rateLimit.consumeAiBudget, {});

    const allPositions = await ctx.runQuery(internal.extract.positionsForTender, {
      tenderId: args.tenderId,
    });
    // Cap positions per request so one call can't spend unboundedly (no auth yet).
    const MAX_POSITIONS = 60;
    const positions = allPositions.slice(0, MAX_POSITIONS);

    const reqs: ReqRow[] = [];
    for (const p of positions) {
      const materials = await extractPositionMaterials({
        oz: p.oz,
        shortText: p.shortText,
        longText: p.longText,
        qty: p.qty,
        unit: p.unit,
      });
      for (const m of materials) {
        reqs.push({
          positionId: p._id,
          description: m.description,
          qty: m.qty,
          unit: m.unit,
          category: m.category,
          confidence: m.confidence,
        });
      }
    }

    await ctx.runMutation(internal.extract.replaceMaterialReqs, {
      tenderId: args.tenderId,
      reqs,
    });
    return { positions: positions.length, materials: reqs.length };
  },
});
