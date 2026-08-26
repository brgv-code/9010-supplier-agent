import { readFileSync } from "node:fs";
import { parseX83 } from "./gaeb/parseX83.js";

/** Tiny CLI to eyeball a parse: `npm run parse -- <file.x83>` */
const path = process.argv[2];
if (!path) {
  console.error("usage: npm run parse -- <file.x83>");
  process.exit(1);
}

const parsed = parseX83(readFileSync(path, "utf-8"));
console.log(
  `Phase X${parsed.phase} · GAEB ${parsed.gaebVersion} · ${parsed.currency} · ${parsed.projectName}`,
);
console.log(`${parsed.positions.length} positions:\n`);
for (const p of parsed.positions) {
  const qty = p.qty === null ? "  (TBD)" : String(p.qty).padStart(6);
  console.log(`  ${p.oz.padEnd(12)} ${qty} ${p.unit.padEnd(5)}  ${p.shortText}`);
}
