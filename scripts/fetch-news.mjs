import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : path.resolve(args[index + 1]);
};
const sourcesPath = option("--sources", path.join(root, "data", "sources.json"));
const outputPath = option("--output", path.join(root, "data", "candidates.json"));
const relevant = /\b(gta\s*(?:6|vi)|grand\s+theft\s+auto\s*(?:6|vi)|leonida|jason\s+(?:and|&)\s+lucia|lucia\s+(?:and|&)\s+jason)\b/i;

function text(value = "") {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? text(match[1]) : "";
}
function atomLink(block) {
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  const any = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  return text((alternate || any || [])[1] || "");
}
function imageLink(block) {
  const match = block.match(/<(?:media:thumbnail|media:content|itunes:image|enclosure)\b[^>]*(?:url|href)=["']([^"']+)["']/i);
  return text(match?.[1] || "");
}
function parseFeed(xml) {
  const atom = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  if (atom.length) return atom.map((block) => ({ title: tag(block, "title"), url: atomLink(block), imageUrl: imageLink(block), externalId: tag(block, "id"), date: tag(block, "published") || tag(block, "updated"), summary: tag(block, "media:description") || tag(block, "summary") || tag(block, "content") }));
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => {
    const block = match[0];
    return { title: tag(block, "title"), url: tag(block, "link") || tag(block, "guid"), imageUrl: imageLink(block), externalId: tag(block, "guid"), date: tag(block, "pubDate") || tag(block, "dc:date"), summary: tag(block, "description") || tag(block, "content:encoded") };
  });
}
function normalized(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|feature$|si$)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return rawUrl; }
}
function categoryFor(title) {
  if (/leak|datamin|footage/i.test(title)) return "Leaks";
  if (/rumou?r|report|claim|alleg/i.test(title)) return "Rumeurs";
  if (/guide|how to|tips|cheat|solution/i.test(title)) return "Guides";
  if (/analysis|breakdown|detail|feature|system/i.test(title)) return "Analyses";
  if (/rockstar|take-two|trailer|release|official/i.test(title)) return "Rockstar";
  return "News";
}
function statusFor(source, category) {
  if (category === "Leaks") return "LEAK";
  if (category === "Guides") return "GUIDE";
  if (category === "Analyses") return "THEORY";
  return source.tier === "A" ? "CONFIRMED" : "RUMOR";
}
function platformFor(source) {
  if (/youtube/i.test(source.type)) return "YOUTUBE";
  if (/x\b/i.test(source.type)) return "X";
  return "WEB";
}
function isoDate(value, fallback) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.valueOf()) ? fallback : date.toISOString();
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }

const [sourcesDoc, previous] = await Promise.all([
  fs.readFile(sourcesPath, "utf8").then(JSON.parse),
  fs.readFile(outputPath, "utf8").then(JSON.parse).catch(() => ({ version: 1, generatedAt: null, failures: [], candidates: [] }))
]);
const detectedAt = new Date().toISOString();
const candidates = [...(previous.candidates || [])];
const known = new Set(candidates.map((candidate) => `${candidate.source.sourceId}|${candidate.source.externalId}|${candidate.source.sourceUrlCanonical}`));
const failures = [];
let added = 0;
let enriched = 0;

for (const source of sourcesDoc.sources.filter((item) => item.feedUrl)) {
  try {
    const response = await fetch(source.feedUrl, { headers: { "user-agent": "GTA-6-Watch/1.0 (+https://github.com/)" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    for (const item of parseFeed(await response.text())) {
      const haystack = `${item.title} ${item.summary}`;
      if (!relevant.test(haystack) || !item.title || !item.url) continue;
      const sourceUrlRaw = item.url;
      const sourceUrlCanonical = normalized(sourceUrlRaw);
      const imageUrlRaw = item.imageUrl || null;
      const imageUrlCanonical = imageUrlRaw ? normalized(imageUrlRaw) : null;
      const externalId = item.externalId || sourceUrlCanonical;
      const dedupeKey = `${source.id}|${externalId}|${sourceUrlCanonical}`;
      if (known.has(dedupeKey)) {
        const existing = candidates.find((candidate) => `${candidate.source.sourceId}|${candidate.source.externalId}|${candidate.source.sourceUrlCanonical}` === dedupeKey);
        if (existing && imageUrlRaw && !existing.source.imageUrlRaw) {
          existing.source.imageUrlRaw = imageUrlRaw;
          existing.source.imageUrlCanonical = imageUrlCanonical;
          enriched += 1;
        }
        continue;
      }
      const categorySuggested = categoryFor(item.title);
      const summary = text(item.summary).slice(0, 520) || `New publication detected from ${source.name}. Open the source to verify the details.`;
      const contentHash = sha(`${item.title}\n${summary}\n${sourceUrlCanonical}`);
      const candidateId = `candidate-${source.id}-${sha(`${externalId}|${sourceUrlCanonical}`).slice(0, 16)}`;
      candidates.push({
        candidateId,
        detectedAt,
        publishedAt: isoDate(item.date, detectedAt),
        title: item.title,
        summary,
        statusSuggested: statusFor(source, categorySuggested),
        confidenceSuggested: Math.max(0, Math.min(1, Number(source.score || 0) / 100)),
        categorySuggested,
        source: { sourceId: source.id, sourceName: source.name, sourceTier: Number(source.score || 0), sourceUrlRaw, sourceUrlCanonical, ...(imageUrlRaw ? { imageUrlRaw, imageUrlCanonical } : {}), externalId, platform: platformFor(source) },
        contentHash,
        reviewState: "PENDING",
        reviewReason: null,
        canonicalNewsId: null,
        reviewHistory: [{ state: "PENDING", reason: null, timestamp: detectedAt }]
      });
      known.add(dedupeKey);
      added += 1;
    }
  } catch (error) {
    failures.push({ sourceId: source.id, message: error.message });
  }
}

const dataChanged = JSON.stringify({ failures: previous.failures || [], candidates: previous.candidates || [] }) !== JSON.stringify({ failures, candidates });
if (!dataChanged) {
  console.log(`GTA 6 Watch: no candidate changes (${candidates.length} candidates).`);
  process.exit(0);
}
await fs.writeFile(outputPath, `${JSON.stringify({ version: 1, generatedAt: detectedAt, failures, candidates }, null, 2)}\n`);
console.log(`GTA 6 Watch: ${added} new candidates, ${enriched} illustrations added, ${candidates.length} total, ${failures.length} source failures.`);
