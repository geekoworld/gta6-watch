import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data");
const [canonical, candidates] = await Promise.all([
  fs.readFile(path.join(dataPath, "canonical-news.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(dataPath, "candidates.json"), "utf8").then(JSON.parse)
]);
const imagesByEvidence = new Map();
for (const candidate of candidates.candidates) {
  const source = candidate.source;
  if (!source.imageUrlCanonical) continue;
  imagesByEvidence.set(`${source.sourceId}|${source.sourceUrlCanonical}`, source);
}
let updated = 0;
for (const record of canonical.records) {
  let recordChanged = false;
  for (const source of record.sources) {
    const image = imagesByEvidence.get(`${source.sourceId}|${source.sourceUrlCanonical}`);
    if (image && !source.imageUrlCanonical) {
      source.imageUrlRaw = image.imageUrlRaw;
      source.imageUrlCanonical = image.imageUrlCanonical;
      recordChanged = true;
      updated += 1;
    }
  }
  if (recordChanged) record.updatedAt = new Date().toISOString();
}
if (!updated) {
  console.log("No canonical article images to backfill.");
  process.exit(0);
}
await fs.writeFile(path.join(dataPath, "canonical-news.json"), `${JSON.stringify(canonical, null, 2)}\n`);
console.log(`Backfilled ${updated} source illustrations into canonical articles.`);
