"use node";

import { v } from "convex/values";
import { extractPositionsFromText } from "../src/ai/positionExtractor.js";
import { extractPdfText } from "../src/pdf/extractPdfText.js";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { requireUserId } from "./lib";

// PDF tender ingest: PDF -> text (deterministic) -> positions (LLM) -> store.
// Node runtime (unpdf + Mastra). Needs OPENAI_API_KEY on the deployment.
export const ingestUploadedPdf = action({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ tenderId: Id<"tenders">; positionCount: number }> => {
    await requireUserId(ctx); // must be signed in
    const blob = await ctx.storage.get(args.fileId);
    if (!blob) throw new Error("uploaded file not found in storage");
    if (blob.size > 10 * 1024 * 1024) throw new Error("PDF too large (max 10MB)");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const text = await extractPdfText(bytes);
    if (text.trim().length === 0) {
      throw new Error("no extractable text in PDF (is it a scan? OCR not supported yet)");
    }

    // Gate OpenAI spend on this public endpoint (throws if the hourly budget is spent).
    await ctx.runMutation(internal.rateLimit.consumeAiBudget, {});
    const extracted = await extractPositionsFromText(text);
    const positions = extracted.positions.map((p) => ({
      oz: p.oz,
      shortText: p.shortText,
      longText: p.longText,
      qty: p.qty,
      unit: p.unit,
      kind: "normal",
      sourceId: "",
      confidence: p.confidence,
    }));

    const tenderId: Id<"tenders"> = await ctx.runMutation(internal.ingest.insertParsed, {
      fileId: args.fileId,
      source: "pdf",
      projectName: extracted.projectName || "(untitled PDF tender)",
      phase: "",
      gaebVersion: "",
      currency: extracted.currency || "",
      positions,
    });
    return { tenderId, positionCount: positions.length };
  },
});
