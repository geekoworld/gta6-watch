import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = path.join(root, "data", "canonical-news.json");
const outputPath = path.join(root, "sitemap.xml");
const siteUrl = "https://gta6-watch.xyz/";

const canonical = JSON.parse(await fs.readFile(canonicalPath, "utf8"));
const published = canonical.records.filter((record) => record.publication?.articlePublishedAt !== null);
const latest = published.map((record) => record.updatedAt || record.publishedAt).filter(Boolean).sort().at(-1) || new Date().toISOString();
const lastmod = new Date(latest).toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
</urlset>
`;

await fs.writeFile(outputPath, xml);
console.log(`Sitemap generated: 1 current public URL, updated ${lastmod}.`);
