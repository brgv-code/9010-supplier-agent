import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGaebNumber, parseX83 } from "../src/gaeb/parseX83.js";

// Minimal X83 builder for the robustness tests.
function x83(inner: string, dp = "83"): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2">
  <Award><DP>${dp}</DP><BoQ><BoQBody><Itemlist>${inner}</Itemlist></BoQBody></BoQ></Award>
</GAEB>`;
}
const item = (rNo: string, qty: string) =>
  `<Item RNoPart="${rNo}"><Qty>${qty}</Qty><QU>m</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt>Kabel</TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>`;

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

describe("parseGaebNumber", () => {
  it("parses plain and dot-decimal numbers", () => {
    expect(parseGaebNumber("600")).toBe(600);
    expect(parseGaebNumber("120.5")).toBe(120.5);
    expect(parseGaebNumber("0")).toBe(0);
  });
  it("parses German comma decimals and dot thousands", () => {
    expect(parseGaebNumber("1,5")).toBe(1.5);
    expect(parseGaebNumber("1.234,56")).toBe(1234.56);
  });
  it("returns null for empty/garbage", () => {
    expect(parseGaebNumber("")).toBeNull();
    expect(parseGaebNumber(undefined)).toBeNull();
    expect(parseGaebNumber("abc")).toBeNull();
  });
});

describe("parseX83 robustness (fixed review bugs)", () => {
  it("parses comma-decimal quantities instead of dropping them", () => {
    const parsed = parseX83(x83(item("001", "1,5")));
    expect(parsed.positions[0]?.qty).toBe(1.5);
  });

  it("throws on a non-83 exchange phase instead of parsing it as a tender", () => {
    expect(() => parseX83(x83(item("001", "5"), "84"))).toThrow(/DP=84/);
  });

  it("collects positions across multiple <Award> blocks (no silent empty)", () => {
    const two = `<?xml version="1.0"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2">
  <Award><DP>83</DP><BoQ><BoQBody><Itemlist>${item("001", "5")}</Itemlist></BoQBody></BoQ></Award>
  <Award><DP>83</DP><BoQ><BoQBody><Itemlist>${item("002", "9")}</Itemlist></BoQBody></BoQ></Award>
</GAEB>`;
    expect(parseX83(two).positions).toHaveLength(2);
  });

  it("does not produce a trailing-dot OZ when RNoPart is missing", () => {
    const noRNo = x83(
      `<Item><Qty>5</Qty><QU>m</QU><Description><CompleteText><OutlineText><OutlTxt><TextOutlTxt>x</TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>`,
    );
    expect(parseX83(noRNo).positions[0]?.oz).toBe("");
  });

  it("fails loudly on non-GAEB input", () => {
    expect(() => parseX83("<html><body>not gaeb</body></html>")).toThrow(/GAEB/);
  });
});
