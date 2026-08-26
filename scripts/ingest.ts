import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

// End-to-end smoke test against your running dev deployment:
//   CONVEX_URL="https://<your-deployment>.convex.cloud" npx tsx scripts/ingest.ts test/fixtures/sample.x83
// (find the URL in .env.local, or run `npx convex dashboard`)

const url = process.env.CONVEX_URL;
const file = process.argv[2];
if (!url) {
  console.error("Set CONVEX_URL to your *.convex.cloud deployment URL (see .env.local).");
  process.exit(1);
}
if (!file) {
  console.error("usage: CONVEX_URL=... npx tsx scripts/ingest.ts <file.x83>");
  process.exit(1);
}

const client = new ConvexHttpClient(url);
const bytes = readFileSync(file);

const uploadUrl = await client.mutation(api.ingest.generateUploadUrl, {});
const uploaded = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": "application/xml" },
  body: bytes,
});
const { storageId } = (await uploaded.json()) as { storageId: string };

const result = await client.action(api.ingestActions.ingestUploadedX83, {
  fileId: storageId as never,
});
console.log("ingested:", result);

const positions = await client.query(api.ingest.listPositions, {
  tenderId: result.tenderId,
});
console.log(`stored ${positions.length} positions. first:`, positions[0]);
