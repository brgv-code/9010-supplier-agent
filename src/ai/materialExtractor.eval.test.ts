import { describe, expect, it } from "vitest";
import { extractPositionMaterials } from "./materialExtractor.js";

// Real eval: hits OpenAI, so it is skipped unless OPENAI_API_KEY is set (keeps CI green).
// Run locally with: OPENAI_API_KEY=sk-... pnpm test
const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!hasKey)("material-extractor eval (calls OpenAI)", () => {
  it("extracts the cable material with a plausible category and valid confidence", async () => {
    const materials = await extractPositionMaterials({
      oz: "01.02.002",
      shortText: "NYM-J 3x1,5 Mantelleitung",
      longText:
        "Mantelleitung NYM-J 3x1,5 mm² liefern und auf Putz verlegen, inkl. Befestigungsmaterial.",
      qty: 120,
      unit: "m",
    });

    expect(materials.length).toBeGreaterThan(0);
    const joined = materials.map((m) => m.description.toLowerCase()).join(" ");
    expect(joined).toContain("nym");
    expect(materials.every((m) => m.confidence >= 0 && m.confidence <= 1)).toBe(true);
    expect(materials.every((m) => m.category.trim().length > 0)).toBe(true);
  }, 30_000);

  it("returns no (or minimal) materials for a pure-labour position", async () => {
    const materials = await extractPositionMaterials({
      oz: "01.99.001",
      shortText: "Baustelle räumen",
      longText: "Baustelle nach Abschluss der Arbeiten besenrein räumen.",
      qty: 1,
      unit: "psch",
    });

    // Labour only: ideally empty. Allow a small tolerance for model variance.
    expect(materials.length).toBeLessThanOrEqual(1);
  }, 30_000);
});
