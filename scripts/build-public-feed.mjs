import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCanonicalDocument } from "./validate-content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = path.join(root, "data", "canonical-news.json");
const outputPath = path.join(root, "data", "news.json");
const schemaPath = path.join(root, "news.schema.json");
const credibility = { CONFIRMED: "Confirmé", RUMOR: "Rumeur", LEAK: "Leak", THEORY: "Probable", GUIDE: "Probable" };

function sourceTierLabel(score) {
  if (score >= 90) return "A";
  if (score >= 70) return "B";
  return "C";
}

const [canonical, schema] = await Promise.all([
  fs.readFile(canonicalPath, "utf8").then(JSON.parse),
  fs.readFile(schemaPath, "utf8").then(JSON.parse)
]);
const errors = validateCanonicalDocument(canonical, schema);
if (errors.length) throw new Error(`Impossible de générer le flux: ${errors.join(" ")}`);

const articles = canonical.records
  .filter((record) => record.publication.articlePublishedAt !== null)
  .map((record) => {
    const primary = record.sources[0];
    return {
      id: record.newsId,
      title: record.title,
      category: record.category,
      credibility: credibility[record.status],
      source: primary.sourceName,
      sourceId: primary.sourceId,
      sourceTier: sourceTierLabel(primary.sourceTier),
      sourceScore: primary.sourceTier,
      url: primary.sourceUrlCanonical,
      date: record.publishedAt.slice(0, 10),
      summary: record.summary,
      favorite: false,
      collectedAt: record.collectedAt
    };
  })
  .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.sourceScore) || 0) - (Number(a.sourceScore) || 0))
  .slice(0, 250);

let previous = null;
try {
  previous = JSON.parse(await fs.readFile(outputPath, "utf8"));
} catch {}
if (previous && JSON.stringify(previous.articles) === JSON.stringify(articles) && JSON.stringify(previous.failures || []) === "[]") {
  console.log(`Flux public inchangé: ${articles.length} articles publiés.`);
  process.exit(0);
}
await fs.writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), failures: [], articles }, null, 2)}\n`);
console.log(`Flux public généré: ${articles.length} articles publiés.`);
