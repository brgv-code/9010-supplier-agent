import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseX83 } from "../src/gaeb/parseX83.js";

// Generates a PDF bill-of-quantities fixture from the electrical X83, so we have a
// realistic PDF to test the PDF text extractor against. Run: pnpm exec tsx scripts/make-pdf-fixture.ts

const parsed = parseX83(readFileSync("test/fixtures/electrical-tender.x83", "utf-8"));

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

let page = doc.addPage([595, 842]); // A4
let y = 800;
const line = (text: string, x = 50, size = 10, f = font) => {
  if (y < 60) {
    page = doc.addPage([595, 842]);
    y = 800;
  }
  page.drawText(text, { x, y, size, font: f });
  y -= size + 4;
};

line(parsed.projectName, 50, 14, bold);
line(`Leistungsverzeichnis - Angebotsaufforderung (X83) - Waehrung ${parsed.currency}`, 50, 9);
y -= 8;

for (const p of parsed.positions) {
  line(`${p.oz}   ${p.shortText}`, 50, 10, bold);
  line(`Menge: ${p.qty ?? "-"} ${p.unit}`, 65, 9);
  line(p.longText.slice(0, 95), 65, 8);
  y -= 6;
}

writeFileSync("test/fixtures/electrical-tender.pdf", await doc.save());
console.log(`wrote test/fixtures/electrical-tender.pdf (${parsed.positions.length} positions)`);
