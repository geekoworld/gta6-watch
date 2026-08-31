import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data");
const [publicFeed, sources] = await Promise.all([
  fs.readFile(path.join(dataPath, "news.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(dataPath, "sources.json"), "utf8").then(JSON.parse)
]);
const canonicalPath = path.join(dataPath, "canonical-news.json");
try {
  const existing = JSON.parse(await fs.readFile(canonicalPath, "utf8"));
  if (Array.isArray(existing.records) && existing.records.length > 0) {
    throw new Error("Migration annulée: canonical-news.json contient déjà des enregistrements.");
  }
} catch (error) {
  if (error.message.startsWith("Migration annulée:")) throw error;
}

const sourceById = new Map(sources.sources.map((source) => [source.id, source]));
const statusFor = (article) => {
  if (article.credibility === "Confirmé") return "CONFIRMED";
  if (article.credibility === "Leak" || article.category === "Leaks") return "LEAK";
  if (article.category === "Guides") return "GUIDE";
  if (article.credibility === "Rumeur" || article.category === "Rumeurs") return "RUMOR";
  return "THEORY";
};

const records = publicFeed.articles.map((article) => {
  const source = sourceById.get(article.sourceId);
  const timestamp = article.collectedAt || `${article.date}T12:00:00.000Z`;
  const publishedAt = `${article.date}T12:00:00.000Z`;
  const sourceScore = Number(source?.score ?? article.sourceScore ?? 0);
  return {
    newsId: `gta6-legacy-${String(article.id).toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    title: article.title,
    summary: article.summary,
    status: statusFor(article),
    confidence: article.credibility === "Confirmé" ? 100 : sourceScore,
    category: article.category,
    publishedAt,
    collectedAt: timestamp,
    updatedAt: timestamp,
    sources: [{
      sourceId: article.sourceId || "legacy-source",
      sourceName: article.source || "Legacy source",
      sourceTier: sourceScore,
      sourceUrlRaw: article.url,
      sourceUrlCanonical: article.url,
      externalId: article.id,
      publishedAt
    }],
    scores: { article: 0, x: 0, shorts: 0 },
    publication: { articlePublishedAt: timestamp, xPostId: null, shortsQueueId: null }
  };
});

await fs.writeFile(canonicalPath, `${JSON.stringify({ version: 1, records }, null, 2)}\n`);
console.log(`Migration terminée: ${records.length} articles historiques canoniques.`);
