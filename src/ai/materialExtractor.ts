import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

// The model-driven step: turn one GAEB position into the materials a tradesperson must buy.
// Kept free of Convex imports so it can be unit/eval-tested and called from a Convex Node action.

export const materialSchema = z.object({
  materials: z.array(
    z.object({
      description: z
        .string()
        .describe("the concrete material to buy, e.g. 'NYM-J 3x1,5 mm² Mantelleitung'"),
      qty: z.number().nullable().describe("quantity if determinable from the position, else null"),
      unit: z.string().describe("unit for the quantity, e.g. 'm' or 'Stück'; empty if unknown"),
      category: z
        .string()
        .describe("coarse category for grouping suppliers, e.g. 'Kabel/Leitungen'"),
      confidence: z.number().min(0).max(1).describe("0..1 confidence in this extraction"),
    }),
  ),
});

export type MaterialNeed = z.infer<typeof materialSchema>["materials"][number];

export const materialExtractor = new Agent({
  id: "material-extractor",
  name: "material-extractor",
  instructions: [
    "You extract the physical materials a tradesperson must purchase to fulfil a single GAEB construction tender position (any trade; 9010 starts with electrical, but a tender can be any).",
    "Input is the position's short text, long text, quantity and unit.",
    "For each material return: a concrete description, its quantity and unit if determinable (else qty null), a coarse category a supplier would recognise, and a confidence 0..1.",
    "Never invent prices. If the position is pure labour or has no purchasable material, return an empty materials array.",
    "Prefer German trade category names.",
  ].join(" "),
  model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
});

export interface PositionInput {
  oz: string;
  shortText: string;
  longText: string;
  qty: number | null;
  unit: string;
}

export async function extractPositionMaterials(pos: PositionInput): Promise<MaterialNeed[]> {
  const prompt = [
    `Position OZ: ${pos.oz}`,
    `Short text: ${pos.shortText}`,
    `Long text: ${pos.longText || "(none)"}`,
    `Quantity: ${pos.qty === null ? "not given" : pos.qty} ${pos.unit}`,
  ].join("\n");

  const result = await materialExtractor.generate(prompt, {
    structuredOutput: { schema: materialSchema },
  });
  const out = result.object as z.infer<typeof materialSchema> | undefined;
  return out?.materials ?? [];
}
