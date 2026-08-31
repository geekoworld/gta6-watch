import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATUSES = new Set(["CONFIRMED", "RUMOR", "LEAK", "THEORY", "GUIDE"]);
const REVIEW_STATES = new Set(["PENDING", "APPROVED", "REJECTED", "DUPLICATE"]);
const SCORE_FIELDS = ["article", "x", "shorts"];

async function readJson(relativePath) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    throw new Error(`${relativePath}: JSON invalide (${error.message})`);
  }
}

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && /T/.test(value);
}

function validUrl(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function boundedInteger(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export function validateCanonicalDocument(document, schema) {
  const errors = [];
  if (!schema?.$defs?.news || schema?.$schema !== "https://json-schema.org/draft/2020-12/schema") errors.push("news.schema.json est absent ou incompatible.");
  if (!document || document.version !== 1 || !Array.isArray(document.records)) return [...errors, "canonical-news.json doit contenir version: 1 et records: []."];
  const newsIds = new Set();
  for (const [index, record] of document.records.entries()) {
    const at = `records[${index}]`;
    if (!requiredString(record.newsId) || !/^gta6-[a-z0-9][a-z0-9-]{7,}$/.test(record.newsId)) errors.push(`${at}.newsId doit être stable et commencer par gta6-.`);
    if (newsIds.has(record.newsId)) errors.push(`${at}.newsId est dupliqué: ${record.newsId}.`);
    newsIds.add(record.newsId);
    for (const field of ["title", "summary", "category"]) if (!requiredString(record[field])) errors.push(`${at}.${field} est requis.`);
    if (!STATUSES.has(record.status)) errors.push(`${at}.status est invalide.`);
    if (!boundedInteger(record.confidence)) errors.push(`${at}.confidence doit être un entier de 0 à 100.`);
    for (const field of ["publishedAt", "collectedAt", "updatedAt"]) if (!isTimestamp(record[field])) errors.push(`${at}.${field} doit être une date ISO.`);
    if (!Array.isArray(record.sources) || record.sources.length === 0) errors.push(`${at}.sources doit contenir au moins une preuve.`);
    const evidence = new Set();
    for (const [sourceIndex, source] of (record.sources || []).entries()) {
      const sourceAt = `${at}.sources[${sourceIndex}]`;
      for (const field of ["sourceId", "sourceName", "externalId"]) if (typeof source[field] !== "string") errors.push(`${sourceAt}.${field} est requis.`);
      if (!boundedInteger(source.sourceTier)) errors.push(`${sourceAt}.sourceTier doit être un entier de 0 à 100.`);
      for (const field of ["sourceUrlRaw", "sourceUrlCanonical"]) if (!validUrl(source[field])) errors.push(`${sourceAt}.${field} doit être une URL HTTP(S) sans identifiants.`);
      if (!isTimestamp(source.publishedAt)) errors.push(`${sourceAt}.publishedAt doit être une date ISO.`);
      const key = `${source.sourceId}|${source.externalId}|${source.sourceUrlRaw}`;
      if (evidence.has(key)) errors.push(`${sourceAt} duplique une preuve existante.`);
      evidence.add(key);
    }
    if (!record.scores || typeof record.scores !== "object") errors.push(`${at}.scores est requis.`);
    for (const field of SCORE_FIELDS) if (!boundedInteger(record.scores?.[field])) errors.push(`${at}.scores.${field} doit être un entier de 0 à 100.`);
    const publication = record.publication;
    if (!publication || typeof publication !== "object") {
      errors.push(`${at}.publication est requis.`);
    } else {
      if (publication.articlePublishedAt !== null && !isTimestamp(publication.articlePublishedAt)) errors.push(`${at}.publication.articlePublishedAt doit être null ou une date ISO.`);
      for (const field of ["xPostId", "shortsQueueId"]) if (publication[field] !== null && !requiredString(publication[field])) errors.push(`${at}.publication.${field} doit être null ou une chaîne non vide.`);
    }
  }
  return errors;
}

export function validateCandidatesDocument(document, schema) {
  const errors = [];
  if (!schema?.$defs?.candidate || schema?.$schema !== "https://json-schema.org/draft/2020-12/schema") errors.push("candidates.schema.json est absent ou incompatible.");
  if (!document || document.version !== 1 || !Array.isArray(document.failures) || !Array.isArray(document.candidates)) return [...errors, "candidates.json doit contenir version: 1, failures: [] et candidates: []."];
  if (document.generatedAt !== null && !isTimestamp(document.generatedAt)) errors.push("candidates.json.generatedAt doit être null ou une date ISO.");
  const ids = new Set();
  for (const [index, candidate] of document.candidates.entries()) {
    const at = `candidates[${index}]`;
    if (!requiredString(candidate.candidateId) || !/^candidate-[a-z0-9][a-z0-9-]{7,}$/.test(candidate.candidateId)) errors.push(`${at}.candidateId est invalide.`);
    if (ids.has(candidate.candidateId)) errors.push(`${at}.candidateId est dupliqué: ${candidate.candidateId}.`);
    ids.add(candidate.candidateId);
    for (const field of ["detectedAt", "publishedAt"]) if (!isTimestamp(candidate[field])) errors.push(`${at}.${field} doit être une date ISO.`);
    for (const field of ["title", "summary", "categorySuggested", "contentHash"]) if (!requiredString(candidate[field])) errors.push(`${at}.${field} est requis.`);
    if (!STATUSES.has(candidate.statusSuggested)) errors.push(`${at}.statusSuggested est invalide.`);
    if (typeof candidate.confidenceSuggested !== "number" || candidate.confidenceSuggested < 0 || candidate.confidenceSuggested > 1) errors.push(`${at}.confidenceSuggested doit être entre 0 et 1.`);
    if (!REVIEW_STATES.has(candidate.reviewState)) errors.push(`${at}.reviewState est invalide.`);
    if (candidate.reviewReason !== null && !requiredString(candidate.reviewReason)) errors.push(`${at}.reviewReason doit être null ou une chaîne non vide.`);
    if (candidate.canonicalNewsId !== null && !requiredString(candidate.canonicalNewsId)) errors.push(`${at}.canonicalNewsId doit être null ou une chaîne non vide.`);
    if (!/^[a-f0-9]{64}$/.test(candidate.contentHash || "")) errors.push(`${at}.contentHash doit être un SHA-256.`);
    const source = candidate.source || {};
    for (const field of ["sourceId", "sourceName", "platform"]) if (!requiredString(source[field])) errors.push(`${at}.source.${field} est requis.`);
    if (typeof source.externalId !== "string") errors.push(`${at}.source.externalId est requis.`);
    if (!boundedInteger(source.sourceTier)) errors.push(`${at}.source.sourceTier doit être un entier de 0 à 100.`);
    for (const field of ["sourceUrlRaw", "sourceUrlCanonical"]) if (!validUrl(source[field])) errors.push(`${at}.source.${field} doit être une URL HTTP(S) sans identifiants.`);
    if (!Array.isArray(candidate.reviewHistory) || candidate.reviewHistory.length === 0) errors.push(`${at}.reviewHistory doit conserver l'historique éditorial.`);
    for (const [historyIndex, entry] of (candidate.reviewHistory || []).entries()) {
      if (!REVIEW_STATES.has(entry.state) || !isTimestamp(entry.timestamp)) errors.push(`${at}.reviewHistory[${historyIndex}] est invalide.`);
    }
  }
  return errors;
}

function validatePublicationLog(document) {
  const errors = [];
  if (!document || document.version !== 1 || !Array.isArray(document.entries)) return ["publication-log.json doit contenir version: 1 et entries: []."];
  const keys = new Set();
  for (const [index, entry] of document.entries.entries()) {
    const at = `publication-log.entries[${index}]`;
    for (const field of ["idempotencyKey", "newsId", "channel", "status"]) if (!requiredString(entry[field])) errors.push(`${at}.${field} est requis.`);
    if (!isTimestamp(entry.createdAt)) errors.push(`${at}.createdAt doit être une date ISO.`);
    if (keys.has(entry.idempotencyKey)) errors.push(`${at}.idempotencyKey est dupliqué.`);
    keys.add(entry.idempotencyKey);
  }
  return errors;
}

function validateHoldList(document) {
  const errors = [];
  if (!document || document.version !== 1 || !Array.isArray(document.records)) return ["rejected-or-held.json doit contenir version: 1 et records: []."];
  for (const [index, record] of document.records.entries()) {
    const at = `rejected-or-held.records[${index}]`;
    for (const field of ["newsId", "reason", "status"]) if (!requiredString(record[field])) errors.push(`${at}.${field} est requis.`);
    if (!isTimestamp(record.timestamp)) errors.push(`${at}.timestamp doit être une date ISO.`);
    if (!Array.isArray(record.sources) || record.sources.length === 0) errors.push(`${at}.sources doit contenir au moins une preuve.`);
  }
  return errors;
}

function validatePublicFeed(document) {
  const errors = [];
  if (!document || !isTimestamp(document.generatedAt) || !Array.isArray(document.failures) || !Array.isArray(document.articles)) return ["data/news.json doit contenir generatedAt, failures et articles."];
  const ids = new Set();
  for (const [index, article] of document.articles.entries()) {
    const at = `articles[${index}]`;
    for (const field of ["id", "title", "category", "credibility", "source", "sourceId", "sourceTier", "url", "date", "summary"]) if (!requiredString(article[field])) errors.push(`${at}.${field} est requis.`);
    if (!validUrl(article.url)) errors.push(`${at}.url doit être une URL HTTP(S) sans identifiants.`);
    if (ids.has(article.id)) errors.push(`${at}.id est dupliqué.`);
    ids.add(article.id);
  }
  return errors;
}

async function main() {
  const publicOnly = process.argv.includes("--public");
  const candidatesOnly = process.argv.includes("--candidates");
  const errors = publicOnly
    ? validatePublicFeed(await readJson("data/news.json"))
    : candidatesOnly
      ? validateCandidatesDocument(await readJson("data/candidates.json"), await readJson("candidates.schema.json"))
    : [
        ...validateCanonicalDocument(await readJson("data/canonical-news.json"), await readJson("news.schema.json")),
        ...validateCandidatesDocument(await readJson("data/candidates.json"), await readJson("candidates.schema.json")),
        ...validatePublicationLog(await readJson("data/publication-log.json")),
        ...validateHoldList(await readJson("data/rejected-or-held.json"))
      ];
  if (errors.length) {
    console.error(`Validation échouée (${errors.length} erreur(s)):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(publicOnly ? "Public feed validé." : candidatesOnly ? "File de candidats validée." : "Modèle canonique et file de candidats validés.");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
