import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "./extractPdfText.js";

const bytes = new Uint8Array(
  readFileSync(
    fileURLToPath(new URL("../../test/fixtures/electrical-tender.pdf", import.meta.url)),
  ),
);

describe("extractPdfText", () => {
  it("pulls the tender text out of a PDF bill of quantities", async () => {
    const text = await extractPdfText(bytes);
    expect(text).toContain("REWE");
    expect(text.toLowerCase()).toContain("nym-j");
    expect(text).toContain("Steckdose");
    expect(text).toContain("Zaehlerschrank");
  });
});
