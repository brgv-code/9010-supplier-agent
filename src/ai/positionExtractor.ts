import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

// Model-driven step for PDF tenders: a PDF bill of quantities is unstructured, so an LLM
// turns its extracted text into positions (unlike GAEB XML, which the rule parser handles).
// Kept free of Convex imports so it can be unit/eval-tested and called from a Convex Node action.

export const positionsSchema = z.object({
  projectName: z.string().describe("the project / tender name if present, else empty string"),
  currency: z.string().describe("currency symbol or code if present, e.g. '€' or 'EUR'; else ''"),
  positions: z.array(
    z.object({
      oz: z.string().describe("the position/line number (Ordnungszahl) as printed, e.g. '01.001'"),
      shortText: z.string().describe("the one-line description of the work"),
      longText: z.string().describe("any longer description text for the position; else ''"),
      qty: z.number().nullable().describe("quantity if given, else null"),
      unit: z.string().describe("unit, e.g. 'm', 'Stück'; else ''"),
      confidence: z.number().min(0).max(1).describe("0..1 confidence in this extracted row"),
    }),
  ),
});

export type ExtractedTender = z.infer<typeof positionsSchema>;

export const positionExtractor = new Agent({
  id: "position-extractor",
  name: "position-extractor",
  instructions: [
    "You extract the line items (positions) from the text of a construction tender / bill of quantities (Leistungsverzeichnis) that arrived as a PDF.",
    "Return each position with its number (Ordnungszahl), short description, any longer text, quantity, unit, and a confidence 0..1.",
    "Also return the project name and currency if present.",
    "Only extract real priceable positions, not headers, totals, page numbers, or boilerplate. If unsure about a row, include it with a low confidence rather than dropping it.",
  ].join(" "),
  model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
});

export async function extractPositionsFromText(text: string): Promise<ExtractedTender> {
  const result = await positionExtractor.generate(`Tender text:\n\n${text}`, {
    structuredOutput: { schema: positionsSchema },
  });
  const out = result.object as ExtractedTender | undefined;
  return out ?? { projectName: "", currency: "", positions: [] };
}
