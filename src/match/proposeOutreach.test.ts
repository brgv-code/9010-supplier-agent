import { describe, expect, it } from "vitest";
import { categoriesMatch, proposeOutreach } from "./proposeOutreach.js";

describe("categoriesMatch", () => {
  it("matches on an overlapping token, case-insensitively", () => {
    expect(categoriesMatch(["Kabel", "Elektro"], "Kabel/Leitungen")).toBe(true);
    expect(categoriesMatch(["Installationsgeräte"], "installationsgeraete")).toBe(false); // no shared token
    expect(categoriesMatch(["Beleuchtung"], "Verteilertechnik")).toBe(false);
  });
});

describe("proposeOutreach", () => {
  const suppliers = [
    { id: "sonepar", categories: ["Kabel", "Installationsgeräte"], reliability: 0.9 },
    { id: "rexel", categories: ["Kabel"], reliability: 0.7 },
    { id: "hager", categories: ["Verteilertechnik"], reliability: 0.8 },
  ];

  it("pairs materials with matching suppliers, ranked by reliability", () => {
    const materials = [
      { id: "cable", category: "Kabel/Leitungen" },
      { id: "box", category: "Verteilertechnik" },
    ];
    const pairs = proposeOutreach(materials, suppliers);
    // cable -> sonepar (0.9) then rexel (0.7); box -> hager
    expect(pairs).toEqual([
      { materialId: "cable", supplierId: "sonepar" },
      { materialId: "cable", supplierId: "rexel" },
      { materialId: "box", supplierId: "hager" },
    ]);
  });

  it("returns no pairs for a material no supplier covers", () => {
    const pairs = proposeOutreach([{ id: "lamp", category: "Beleuchtung" }], suppliers);
    expect(pairs).toEqual([]);
  });
});
