import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.GTA6_WATCH_DATA_DIR ? path.resolve(process.env.GTA6_WATCH_DATA_DIR) : path.join(root, "data");
const [candidateId, ...flags] = process.argv.slice(2);
if (!candidateId || candidateId.startsWith("-")) throw new Error("Usage: node scripts/approve-candidate.mjs <candidateId> [--publish]");
const publish = flags.includes("--publish");
const candidatesPath = path.join(dataDir, "candidates.json");
const canonicalPath = path.join(dataDir, "canonical-news.json");
const [candidatesDoc, canonicalDoc] = await Promise.all([
  fs.readFile(candidatesPath, "utf8").then(JSON.parse),
  fs.readFile(canonicalPath, "utf8").then(JSON.parse)
]);
const candidate = candidatesDoc.candidates.find((item) => item.candidateId === candidateId);
if (!candidate) throw new Error(`Unknown candidate: ${candidateId}`);
if (!["PENDING", "APPROVED"].includes(candidate.reviewState)) throw new Error(`Candidate ${candidateId} is ${candidate.reviewState} and cannot be approved.`);

const now = new Date().toISOString();
const evidence = {
  sourceId: candidate.source.sourceId,
  sourceName: candidate.source.sourceName,
  sourceTier: candidate.source.sourceTier,
  sourceUrlRaw: candidate.source.sourceUrlRaw,
  sourceUrlCanonical: candidate.source.sourceUrlCanonical,
  ...(candidate.source.imageUrlRaw ? { imageUrlRaw: candidate.source.imageUrlRaw, imageUrlCanonical: candidate.source.imageUrlCanonical } : {}),
  externalId: candidate.source.externalId,
  publishedAt: candidate.publishedAt
};
const matchesEvidence = (record) => record.sources.some((source) => source.sourceId === evidence.sourceId && (source.externalId === evidence.externalId || source.sourceUrlRaw === evidence.sourceUrlRaw || source.sourceUrlCanonical === evidence.sourceUrlCanonical));
let record = candidate.canonicalNewsId ? canonicalDoc.records.find((item) => item.newsId === candidate.canonicalNewsId) : canonicalDoc.records.find(matchesEvidence);
if (!record) {
  const stableKey = `${evidence.sourceId}|${evidence.externalId}|${evidence.sourceUrlCanonical}`;
  const newsId = `gta6-${createHash("sha256").update(stableKey).digest("hex").slice(0, 20)}`;
  record = {
    newsId,
    title: candidate.title,
    summary: candidate.summary,
    status: candidate.statusSuggested,
    confidence: Math.round(candidate.confidenceSuggested * 100),
    category: candidate.categorySuggested,
    publishedAt: candidate.publishedAt,
    collectedAt: candidate.detectedAt,
    updatedAt: now,
    sources: [evidence],
    scores: { article: 0, x: 0, shorts: 0 },
    publication: { articlePublishedAt: publish ? now : null, xPostId: null, shortsQueueId: null }
  };
  canonicalDoc.records.push(record);
} else {
  const hasEvidence = record.sources.some((source) => source.sourceId === evidence.sourceId && source.externalId === evidence.externalId && source.sourceUrlRaw === evidence.sourceUrlRaw);
  if (!hasEvidence) record.sources.push(evidence);
  record.updatedAt = now;
  if (publish && record.publication.articlePublishedAt === null) record.publication.articlePublishedAt = now;
}

candidate.reviewState = "APPROVED";
candidate.reviewReason = publish ? "Approved and published manually." : "Approved manually; not published.";
candidate.canonicalNewsId = record.newsId;
candidate.reviewHistory.push({ state: "APPROVED", reason: candidate.reviewReason, timestamp: now });
await Promise.all([
  fs.writeFile(candidatesPath, `${JSON.stringify(candidatesDoc, null, 2)}\n`),
  fs.writeFile(canonicalPath, `${JSON.stringify(canonicalDoc, null, 2)}\n`)
]);
console.log(`${candidateId} approved as ${record.newsId}${publish ? " and published" : " (not published)"}.`);
