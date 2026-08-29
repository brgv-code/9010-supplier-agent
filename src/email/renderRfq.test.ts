import { describe, expect, it } from "vitest";
import { renderRfq } from "./renderRfq.js";

describe("renderRfq", () => {
  const out = renderRfq({
    supplierName: "Sonepar",
    projectName: "REWE Markt Neubau",
    materials: [
      { description: "NYM-J 3x1,5 Mantelleitung", qty: 450, unit: "m" },
      { description: "Schuko-Steckdose UP", qty: null, unit: "" },
    ],
  });

  it("puts the project in the subject", () => {
    expect(out.subject).toBe("Angebotsanfrage: REWE Markt Neubau");
  });

  it("addresses the supplier and lists the materials with quantities", () => {
    expect(out.body).toContain("Sonepar");
    expect(out.body).toContain("- NYM-J 3x1,5 Mantelleitung (450 m)");
    expect(out.body).toContain("- Schuko-Steckdose UP"); // no qty shown when null
    expect(out.body).not.toContain("(null");
  });
});
