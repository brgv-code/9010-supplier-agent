import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseX83 } from "../src/gaeb/parseX83.js";

const sample = readFileSync(
  fileURLToPath(new URL("./fixtures/sample.x83", import.meta.url)),
  "utf-8",
);

describe("parseX83", () => {
  const parsed = parseX83(sample);
  const byOz = (oz: string) => {
    const p = parsed.positions.find((pos) => pos.oz === oz);
    if (!p) throw new Error(`no position with oz ${oz}`);
    return p;
  };

  it("reads the exchange phase, version and currency", () => {
    expect(parsed.phase).toBe("83");
    expect(parsed.gaebVersion).toBe("3.2");
    expect(parsed.currency).toBe("€");
    expect(parsed.projectName).toBe("Example Project");
  });

  it("flattens all positions across nested categories", () => {
    // 1 site-prep item under 01.01, plus 5 construction items under 01.02
    expect(parsed.positions).toHaveLength(6);
  });

  it("builds the Ordnungszahl from the RNoPart chain", () => {
    const ozs = parsed.positions.map((p) => p.oz);
    expect(ozs).toEqual([
      "01.01.001",
      "01.02.001",
      "01.02.002",
      "01.02.003",
      "01.02.004",
      "01.02.005",
    ]);
  });

  it("extracts short and long text (unwrapping span/p)", () => {
    const filling = byOz("01.02.002");
    expect(filling.shortText).toBe("Filling");
    expect(filling.longText).toContain("Filling of excavated building pit");
  });

  it("parses quantity and unit for a normal position", () => {
    const filling = byOz("01.02.002");
    expect(filling.qty).toBe(600);
    expect(filling.unit).toBe("m³");
    expect(filling.kind).toBe("normal");
  });

  it("handles QtyTBD positions (quantity to be determined)", () => {
    const excavation = byOz("01.02.001");
    expect(excavation.kind).toBe("qtyTBD");
    expect(excavation.qty).toBeNull();
    expect(excavation.unit).toBe("m³");
    expect(excavation.shortText).toBe("Excavation");
  });

  it("carries the source Item ID for traceability", () => {
    const filling = byOz("01.02.002");
    expect(filling.sourceId).toBe("ID_133be09c-4ca4-4b91-a449-b19515a781c0");
  });

  it("never invents a price (X83 has none)", () => {
    // Position has no price fields at all - pricing is the bidder's job (produces X84).
    for (const p of parsed.positions) {
      expect(p).not.toHaveProperty("unitPrice");
    }
  });
});
