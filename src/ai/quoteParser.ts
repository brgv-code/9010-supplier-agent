import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

// Model step: parse a supplier's free-text reply into per-material prices. The materials we
// asked about are passed in numbered, and the model references them by 1-based index (robust
// mapping back to our records). Pure of Convex so it is eval-testable.

export const quotesSchema = z.object({
  quotes: z.array(
    z.object({
      materialIndex: z
        .number()
        .int()
        .describe("1-based index of the material (from the provided list) this price is for"),
      unitPrice: z.number().describe("quoted price per unit"),
      moq: z.number().nullable().describe("minimum order quantity if stated, else null"),
      leadTimeDays: z.number().nullable().describe("lead time in days if stated, else null"),
      confidence: z.number().min(0).max(1).describe("0..1 confidence in this parsed price"),
    }),
  ),
});

export type ParsedQuote = z.infer<typeof quotesSchema>["quotes"][number];

export const quoteParser = new Agent({
  id: "quote-parser",
  name: "quote-parser",
  instructions: [
    "You parse a construction supplier's free-text reply (often German) into quoted prices.",
    "You are given the list of materials we asked about, numbered. For each material the supplier quoted, return its 1-based index, the unit price, and MOQ / lead time if stated.",
    "Handle comma decimals (e.g. 4,85 means 4.85). Skip materials the reply does not quote. If unsure about a price, include it with a low confidence rather than dropping it.",
  ].join(" "),
  model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
});

export async function extractQuotes(
  replyText: string,
  materials: { description: string }[],
): Promise<ParsedQuote[]> {
  const list = materials.map((m, i) => `${i + 1}. ${m.description}`).join("\n");
  const prompt = `Materials we asked about:\n${list}\n\nSupplier reply:\n${replyText}`;
  const result = await quoteParser.generate(prompt, {
    structuredOutput: { schema: quotesSchema },
  });
  const out = result.object as z.infer<typeof quotesSchema> | undefined;
  return out?.quotes ?? [];
}
