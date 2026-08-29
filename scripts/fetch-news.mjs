import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sourcesDoc = JSON.parse(await fs.readFile(path.join(root, "data", "sources.json"), "utf8"));
const outputPath = path.join(root, "data", "news.json");
const args = new Set(process.argv.slice(2));
const translateExisting = args.has("--translate-existing");
const dryRun = args.has("--dry-run");
const translationModel = "gpt-5-mini";

const relevant = /\b(gta\s*(?:6|vi)|grand\s+theft\s+auto\s*(?:6|vi)|leonida|jason\s+(?:and|&)\s+lucia|lucia\s+(?:and|&)\s+jason)\b/i;

function text(value = "") {
  return value
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

function atomLink(block) {
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  const any = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  return text((alternate || any || [])[1] || "");
}

function parseFeed(xml) {
  const atom = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  if (atom.length) {
    return atom.map((block) => ({
      title: tag(block, "title"),
      url: atomLink(block),
      date: tag(block, "published") || tag(block, "updated"),
      summary: tag(block, "media:description") || tag(block, "summary") || tag(block, "content"),
    }));
  }
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => {
    const block = match[0];
    return {
      title: tag(block, "title"),
      url: tag(block, "link") || tag(block, "guid"),
      date: tag(block, "pubDate") || tag(block, "dc:date"),
      summary: tag(block, "description") || tag(block, "content:encoded"),
    };
  });
}

function cleanSummary(value) {
  const withoutPromos = String(value || "").split(/(?:-{8,}|\bGet \d+% off\b|\bGet 3 Months\b|\bBuy An E-Win\b|\bBecome a Channel Member\b|📌\s*CONTACT ME|\bTwitch:\s*https?:)/i)[0];
  return text(withoutPromos)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryFor(title) {
  if (/leak|datamin|footage/i.test(title)) return "Leaks";
  if (/rumou?r|report|claim|alleg/i.test(title)) return "Rumeurs";
  if (/guide|how to|tips|cheat|solution/i.test(title)) return "Guides";
  if (/analysis|breakdown|detail|feature|system/i.test(title)) return "Analyses";
  if (/rockstar|take-two|trailer|release|official/i.test(title)) return "Rockstar";
  return "News";
}

function normalized(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|feature$|si$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function needsTranslation(article) {
  return !article.translations?.en?.title || !article.translations?.en?.summary || !article.translations?.fr?.title || !article.translations?.fr?.summary;
}

function pendingTranslations() {
  return { en: null, fr: null, status: "pending" };
}

function responseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output || []).flatMap(item => item.content || []).find(item => item.type === "output_text")?.text || "";
}

async function translateArticle(article) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: translationModel,
      reasoning: { effort: "minimal" },
      input: [{
        role: "system",
        content: "Translate the supplied GTA 6 article title and summary faithfully into English and French. Preserve source names, URLs, dates, proper names, quoted text, emojis, capitalization where meaningful, and uncertainty. Do not add, remove, infer, summarize, or editorialize information. Return JSON only with en and fr, each containing title and summary strings.",
      }, {
        role: "user",
        content: JSON.stringify({ title: article.title, summary: article.summary }),
      }],
      text: {
        format: {
          type: "json_schema",
          name: "article_translations",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["en", "fr"],
            properties: {
              en: {
                type: "object",
                additionalProperties: false,
                required: ["title", "summary"],
                properties: { title: { type: "string" }, summary: { type: "string" } },
              },
              fr: {
                type: "object",
                additionalProperties: false,
                required: ["title", "summary"],
                properties: { title: { type: "string" }, summary: { type: "string" } },
              },
            },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
  const translation = JSON.parse(responseText(await response.json()));
  if (!translation?.en?.title || !translation?.en?.summary || !translation?.fr?.title || !translation?.fr?.summary) {
    throw new Error("OpenAI returned an incomplete translation");
  }
  return { ...translation, status: "complete", model: translationModel };
}

const collectedArticles = [];
const failures = [];

for (const source of translateExisting ? [] : sourcesDoc.sources.filter((item) => item.feedUrl)) {
  try {
    const response = await fetch(source.feedUrl, {
      headers: { "user-agent": "GTA6-Watch/1.0 (+https://github.com/)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseFeed(await response.text());
    for (const item of items) {
      const haystack = `${item.title} ${item.summary}`;
      if (!relevant.test(haystack) || !item.title || !item.url) continue;
      const date = new Date(item.date || Date.now());
      collectedArticles.push({
        id: `${source.id}-${createHash("sha256").update(normalized(item.url)).digest("hex").slice(0, 16)}`,
        title: item.title,
        category: categoryFor(item.title),
        credibility: source.defaultStatus,
        source: source.name,
        sourceId: source.id,
        sourceTier: source.tier,
        sourceScore: source.score,
        url: normalized(item.url),
        date: Number.isNaN(date.valueOf()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10),
        summary: cleanSummary(item.summary).slice(0, 520) || `Nouvelle publication détectée depuis ${source.name}. Ouvrir la source pour vérifier les détails.`,
        translations: pendingTranslations(),
        favorite: false,
        collectedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    failures.push({ sourceId: source.id, message: error.message });
  }
}

let previous = { articles: [] };
try {
  previous = JSON.parse(await fs.readFile(outputPath, "utf8"));
} catch {}

const previousByUrl = new Map((previous.articles || []).map((article) => [normalized(article.url), article]));
const merged = new Map();
for (const article of [...collectedArticles, ...(previous.articles || [])]) {
  const key = normalized(article.url);
  if (!merged.has(key)) {
    const prior = previousByUrl.get(key);
    merged.set(key, prior ? { ...article, collectedAt: prior.collectedAt || article.collectedAt, translations: prior.translations || article.translations } : article);
  }
}

const events = new Map();
for (const article of merged.values()) {
  const titleKey = article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const eventKey = `${article.sourceId || article.source}|${article.date}|${titleKey}`;
  if (!events.has(eventKey)) events.set(eventKey, article);
}

let sorted = [...events.values()]
  .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.sourceScore) || 0) - (Number(a.sourceScore) || 0) || String(b.collectedAt || "").localeCompare(String(a.collectedAt || "")))
  .slice(0, 250);

const translationCandidates = sorted.filter(needsTranslation);
if (dryRun) {
  console.log(`GTA6 Watch: ${translationCandidates.length} translation calls would use ${translationModel}.`);
} else if (translationCandidates.length && !process.env.OPENAI_API_KEY) {
  console.warn(`GTA6 Watch: ${translationCandidates.length} translations remain pending (OPENAI_API_KEY is not set).`);
} else if (translationCandidates.length) {
  let translated = 0;
  let pending = 0;
  sorted = await Promise.all(sorted.map(async (article) => {
    if (!translationCandidates.includes(article)) return article;
    try {
      const translations = await translateArticle(article);
      translated += 1;
      return { ...article, translations };
    } catch (error) {
      pending += 1;
      console.warn(`GTA6 Watch: translation pending for ${article.id}: ${error.message}`);
      return { ...article, translations: { ...pendingTranslations(), ...article.translations, status: "pending" } };
    }
  }));
  console.log(`GTA6 Watch: ${translated} translations completed, ${pending} pending.`);
}

const unchanged = JSON.stringify(previous.articles || []) === JSON.stringify(sorted)
  && JSON.stringify(previous.failures || []) === JSON.stringify(failures);
if (unchanged) {
  console.log(`GTA6 Watch: no news changes (${sorted.length} articles).`);
  process.exit(0);
}

await fs.writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), failures, articles: sorted }, null, 2)}\n`);
console.log(`GTA6 Watch: ${sorted.length} articles, ${failures.length} source failures.`);
