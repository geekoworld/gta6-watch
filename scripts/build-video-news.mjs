import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcesPath = path.join(root, "data", "sources.json");
const outputPath = path.join(root, "data", "video-news.json");

function text(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? text(match[1]) : "";
}

function attribute(block, expression) {
  return text(block.match(expression)?.[1] || "");
}

const sources = JSON.parse(await fs.readFile(sourcesPath, "utf8")).sources;
const channel = sources.find((source) => source.id === "gta6-watch-youtube");
if (!channel?.videoFeedUrl) throw new Error("The GTA 6 WATCH YouTube video feed is not configured.");

const response = await fetch(channel.videoFeedUrl, { headers: { "user-agent": "GTA-6-Watch/1.0 (+https://gta6-watch.xyz/)" }, signal: AbortSignal.timeout(20_000) });
if (!response.ok) throw new Error(`Unable to load the GTA 6 WATCH YouTube feed (HTTP ${response.status}).`);
const xml = await response.text();
const videos = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(([entry]) => {
  const videoId = tag(entry, "yt:videoId") || tag(entry, "id").replace("yt:video:", "");
  const url = attribute(entry, /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  const thumbnailUrl = attribute(entry, /<media:thumbnail\b[^>]*url=["']([^"']+)["']/i);
  const publishedAt = tag(entry, "published");
  const summary = tag(entry, "media:description") || tag(entry, "summary");
  return { id: videoId, title: tag(entry, "title"), url, thumbnailUrl, publishedAt, summary, isShort: /\/shorts\//.test(url) };
}).filter((video) => video.id && video.title && video.url && video.thumbnailUrl && !Number.isNaN(Date.parse(video.publishedAt))).slice(0, 15);

if (videos.length === 0) throw new Error("The GTA 6 WATCH YouTube feed did not return valid videos.");
const output = {
  generatedAt: new Date().toISOString(),
  channel: { name: channel.name, url: channel.url },
  videos
};
await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Video News feed generated: ${videos.length} GTA 6 WATCH videos.`);
