import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [html, robots, sitemap] = await Promise.all([
  fs.readFile(path.join(root, "index.html"), "utf8"),
  fs.readFile(path.join(root, "robots.txt"), "utf8"),
  fs.readFile(path.join(root, "sitemap.xml"), "utf8")
]);
const requiredHtml = [
  '<link rel="canonical" href="https://gta6-watch.xyz/">',
  '<meta name="robots" content="index,follow,max-image-preview:large">',
  '<meta property="og:image" content="https://gta6-watch.xyz/assets/gta6-watch-logo.png">',
  '<meta name="twitter:image" content="https://gta6-watch.xyz/assets/gta6-watch-logo.png">',
  '"@type":"WebSite"',
  '"@type":"Organization"'
];
for (const value of requiredHtml) if (!html.includes(value)) throw new Error(`Missing SEO markup: ${value}`);
if (!robots.includes("User-agent: *") || !robots.includes("Sitemap: https://gta6-watch.xyz/sitemap.xml")) throw new Error("robots.txt is incomplete.");
if (!/^<\?xml/.test(sitemap) || !sitemap.includes("<loc>https://gta6-watch.xyz/</loc>")) throw new Error("sitemap.xml is invalid or missing the public homepage.");
console.log("SEO foundation files and markup validated.");
