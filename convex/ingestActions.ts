import { v } from "convex/values";
import { parseX83 } from "../src/gaeb/parseX83.js";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

// Reads the uploaded .x83 from storage, parses it, and commits via an internal mutation.
// Runs in the default Convex runtime; fast-xml-parser is pure JS. If it ever errors on a
// missing Node API, add `"use node";` at the top of this file (this file has no query/mutation).
export const ingestUploadedX83 = action({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ tenderId: Id<"tenders">; positionCount: number }> => {
    const blob = await ctx.storage.get(args.fileId);
    if (!blob) throw new Error("uploaded file not found in storage");
    const xml = await blob.text();
    const parsed = parseX83(xml);

    const tenderId: Id<"tenders"> = await ctx.runMutation(internal.ingest.insertParsed, {
      fileId: args.fileId,
      projectName: parsed.projectName,
      phase: parsed.phase,
      gaebVersion: parsed.gaebVersion,
      currency: parsed.currency,
      positions: parsed.positions,
    });
    return { tenderId, positionCount: parsed.positions.length };
  },
});
