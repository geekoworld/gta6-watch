import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sameTopic } from "./topic-matching.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.GTA6_WATCH_DATA_DIR ? path.resolve(process.env.GTA6_WATCH_DATA_DIR) : path.join(root, "data");
const publish = process.argv.includes("--publish");
const maxAgeHours = 36;
const maxCandidatesPerBatch = 12;
const now = Date.now();
const candidatesPath = path.join(dataDir, "candidates.json");
const canonicalPath = path.join(dataDir, "canonical-news.json");
const logPath = path.join(dataDir, "publication-log.json");

function isRecent(candidate) {
  const detectedAt = Date.parse(candidate.detectedAt);
  return Number.isFinite(detectedAt) && now - detectedAt <= maxAgeHours * 3_600_000;
}

function corroborationCount(candidate, candidates) {
  return new Set(candidates
    .filter((other) => other.candidateId !== candidate.candidateId && other.reviewState === "PENDING" && sameTopic(candidate, other))
    .map((other) => other.source.sourceId)).size;
}

function eligibility(candidate, candidates) {
  const tier = Number(candidate.source.sourceTier || 0);
  const corroborated = corroborationCount(candidate, candidates) >= 1;
  if (!isRecent(candidate)) return { eligible: false, reason: `older than ${maxAgeHours} hours` };
  if (tier >= 70) return { eligible: true, reason: candidate.statusSuggested === "LEAK" ? "sourced leak from A/B source" : "A/B source" };
  if (corroborated) return { eligible: true, reason: candidate.statusSuggested === "LEAK" ? "corroborated sourced leak" : "independently corroborated C-source topic" };
  return { eligible: false, reason: "C-source topic without independent corroboration" };
}

const candidatesDoc = JSON.parse(await fs.readFile(candidatesPath, "utf8"));
const eligible = candidatesDoc.candidates
  .filter((candidate) => candidate.reviewState === "PENDING")
  .map((candidate) => ({ candidate, ...eligibility(candidate, candidatesDoc.candidates) }))
  .filter((item) => item.eligible)
  .sort((left, right) => String(right.candidate.publishedAt).localeCompare(String(left.candidate.publishedAt)) || Number(right.candidate.source.sourceTier || 0) - Number(left.candidate.source.sourceTier || 0));
const selected = eligible.slice(0, maxCandidatesPerBatch).reverse();

if (!publish) {
  console.log(`Dry run: ${eligible.length} candidates eligible; ${selected.length} selected for this scheduled publication.`);
  for (const { candidate, reason } of selected) console.log(`- ${candidate.candidateId} | ${candidate.statusSuggested} | ${candidate.source.sourceName} | ${reason}`);
  process.exit(0);
}

for (const { candidate } of selected) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "approve-candidate.mjs"), candidate.candidateId, "--publish", "--automated"], {
    cwd: root,
    env: { ...process.env, GTA6_WATCH_DATA_DIR: dataDir },
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Unable to publish ${candidate.candidateId}`);
}

const [updatedCandidates, canonical, log] = await Promise.all([
  fs.readFile(candidatesPath, "utf8").then(JSON.parse),
  fs.readFile(canonicalPath, "utf8").then(JSON.parse),
  fs.readFile(logPath, "utf8").then(JSON.parse)
]);
const selectedIds = new Set(selected.map(({ candidate }) => candidate.candidateId));
for (const candidate of updatedCandidates.candidates.filter((item) => selectedIds.has(item.candidateId))) {
  const record = canonical.records.find((item) => item.newsId === candidate.canonicalNewsId);
  if (!record?.publication.articlePublishedAt) continue;
  const idempotencyKey = `article:${record.newsId}`;
  if (log.entries.some((entry) => entry.idempotencyKey === idempotencyKey)) continue;
  log.entries.push({ idempotencyKey, newsId: record.newsId, channel: "website", status: "published", createdAt: record.publication.articlePublishedAt });
}
await fs.writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`);
console.log(`Scheduled publication: ${selected.length} candidates approved; ${log.entries.length} publication log entries.`);
