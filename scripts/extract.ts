import { readFileSync } from "node:fs";
import { extractPositionMaterials } from "../src/ai/materialExtractor.js";
import { parseX83 } from "../src/gaeb/parseX83.js";

// Quick check of the Mastra extractor, no Convex needed:
//   OPENAI_API_KEY=sk-... pnpm extract:demo [file.x83]

if (!process.env.OPENAI_API_KEY) {
  console.error("Set OPENAI_API_KEY to run the extractor.");
  process.exit(1);
}

const file = process.argv[2] ?? "test/fixtures/sample.x83";
const parsed = parseX83(readFileSync(file, "utf-8"));
console.log(`${parsed.positions.length} positions from ${file}\n`);

for (const p of parsed.positions) {
  const materials = await extractPositionMaterials(p);
  console.log(`${p.oz}  ${p.shortText}`);
  if (materials.length === 0) {
    console.log("    (no purchasable material)");
  }
  for (const m of materials) {
    const qty = m.qty === null ? "?" : m.qty;
    console.log(
      `    -> ${m.description} | ${m.category} | ${qty} ${m.unit} | ${Math.round(m.confidence * 100)}%`,
    );
  }
}
