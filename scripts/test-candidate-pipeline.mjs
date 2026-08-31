import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gta6-watch-candidates-"));
const dataDir = path.join(temp, "data");
await fs.mkdir(dataDir);
const now = "2026-08-31T12:00:00.000Z";
const feedUrl = `data:text/xml,${encodeURIComponent("<?xml version=\"1.0\"?><rss><channel><item><title>GTA 6 official test update</title><link>https://example.com/test?utm_source=fixture</link><guid>fixture-1</guid><pubDate>Sun, 31 Aug 2026 12:00:00 GMT</pubDate><description>Controlled GTA VI fixture.</description></item></channel></rss>")}`;
const sourcesPath = path.join(temp, "sources.json");
const collectedPath = path.join(temp, "collected.json");
await fs.writeFile(sourcesPath, JSON.stringify({ sources: [{ id: "fixture-source", name: "Fixture Source", type: "Site officiel", tier: "A", score: 100, feedUrl }] }));
const collect = () => spawnSync(process.execPath, [path.join(root, "scripts", "fetch-news.mjs"), "--sources", sourcesPath, "--output", collectedPath], { encoding: "utf8" });
assert.equal(collect().status, 0, "fixture collection should succeed");
assert.equal(collect().status, 0, "duplicate fixture collection should succeed");
const collected = JSON.parse(await fs.readFile(collectedPath, "utf8"));
assert.equal(collected.candidates.length, 1, "exact duplicate candidates must be skipped");
assert.equal(collected.candidates[0].source.sourceUrlRaw, "https://example.com/test?utm_source=fixture");
assert.equal(collected.candidates[0].source.sourceUrlCanonical, "https://example.com/test");
const candidate = (id, url) => ({
  candidateId: id, detectedAt: now, publishedAt: now, title: "GTA 6 official test update", summary: "A controlled editorial test candidate.", statusSuggested: "CONFIRMED", confidenceSuggested: 1,
  categorySuggested: "Rockstar", source: { sourceId: "test-source", sourceName: "Test Source", sourceTier: 100, sourceUrlRaw: url, sourceUrlCanonical: url, externalId: id, platform: "WEB" },
  contentHash: "a".repeat(64), reviewState: "PENDING", reviewReason: null, canonicalNewsId: null, reviewHistory: [{ state: "PENDING", reason: null, timestamp: now }]
});
const candidates = { version: 1, generatedAt: now, failures: [], candidates: [candidate("candidate-test-00000001", "https://example.com/one"), candidate("candidate-test-00000002", "https://example.com/two"), candidate("candidate-test-00000003", "https://example.com/three"), candidate("candidate-test-00000004", "https://example.com/four")] };
const canonical = { version: 1, records: [] };
await Promise.all([
  fs.writeFile(path.join(dataDir, "candidates.json"), JSON.stringify(candidates)),
  fs.writeFile(path.join(dataDir, "canonical-news.json"), JSON.stringify(canonical))
]);
const run = (script, args) => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { env: { ...process.env, GTA6_WATCH_DATA_DIR: dataDir }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};
run("approve-candidate.mjs", ["candidate-test-00000001"]);
run("approve-candidate.mjs", ["candidate-test-00000002", "--publish"]);
run("reject-candidate.mjs", ["candidate-test-00000003", "DUPLICATE", "Controlled duplicate test"]);
run("reject-candidate.mjs", ["candidate-test-00000004", "REJECTED", "Controlled rejection test"]);
const result = JSON.parse(await fs.readFile(path.join(dataDir, "candidates.json"), "utf8"));
const output = JSON.parse(await fs.readFile(path.join(dataDir, "canonical-news.json"), "utf8"));
assert.equal(result.candidates[0].reviewState, "APPROVED");
assert.equal(result.candidates[0].canonicalNewsId, output.records[0].newsId);
assert.equal(output.records[0].publication.articlePublishedAt, null);
assert.equal(result.candidates[1].reviewState, "APPROVED");
assert.ok(output.records[1].publication.articlePublishedAt);
assert.equal(result.candidates[2].reviewState, "DUPLICATE");
assert.equal(result.candidates[2].reviewHistory.length, 2);
assert.equal(result.candidates[3].reviewState, "REJECTED");
assert.equal(result.candidates[3].reviewHistory.length, 2);
assert.equal(output.records[0].sources[0].sourceUrlRaw, "https://example.com/one");
console.log("Candidate creation, duplicate prevention, approval, optional publication, rejection, duplicate marking, canonical creation, and source preservation passed.");
