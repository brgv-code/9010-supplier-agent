import { describe, expect, it } from "vitest";
import { extractQuotes } from "./quoteParser.js";

const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!hasKey)("quote-parser eval (calls OpenAI)", () => {
  it("maps comma-decimal prices back to the right materials by index", async () => {
    const quotes = await extractQuotes(
      [
        "Sehr geehrte Damen und Herren,",
        "gerne bieten wir an:",
        "Position 1: 4,85 EUR pro Meter, Mindestmenge 100, Lieferzeit 5 Tage",
        "Position 3: 12,50 EUR pro Stück",
        "Mit freundlichen Grüßen",
      ].join("\n"),
      [
        { description: "NYM-J 3x1,5 Mantelleitung" },
        { description: "Schuko-Steckdose UP" },
        { description: "Zaehlerschrank 3-reihig" },
      ],
    );

    const byIndex = new Map(quotes.map((q) => [q.materialIndex, q]));
    expect(byIndex.get(1)?.unitPrice).toBeCloseTo(4.85, 2);
    expect(byIndex.get(3)?.unitPrice).toBeCloseTo(12.5, 2);
    // position 2 was not quoted
    expect(byIndex.has(2)).toBe(false);
  }, 30_000);
});
