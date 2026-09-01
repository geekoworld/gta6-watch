const STOP_WORDS = new Set([
  "a", "an", "and", "are", "at", "auto", "be", "by", "for", "from", "gta", "grand",
  "in", "is", "it", "latest", "new", "news", "of", "on", "or", "the", "theft", "this",
  "to", "update", "updates", "vi", "with"
]);

function normalizedTitle(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/grand\s+theft\s+auto\s*(?:6|vi)/g, " ")
    .replace(/gta\s*(?:6|vi)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topicTokens(value) {
  return new Set(normalizedTitle(value).split(" ").filter((token) => token.length >= 3 && !STOP_WORDS.has(token)));
}

function dateDistanceInDays(left, right) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) return Infinity;
  return Math.abs(leftMs - rightMs) / 86_400_000;
}

export function sourceReliability(source = {}) {
  return Number.isFinite(Number(source.sourceTier)) ? Number(source.sourceTier) : 0;
}

export function sortSourcesByReliability(sources = []) {
  return [...sources].sort((left, right) => sourceReliability(right) - sourceReliability(left));
}

export function topicSimilarity(leftTitle, rightTitle) {
  const left = topicTokens(leftTitle);
  const right = topicTokens(rightTitle);
  if (left.size === 0 || right.size === 0) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / new Set([...left, ...right]).size;
}

export function sameTopic(left, right) {
  if (!left || !right || left.categorySuggested && right.category && left.categorySuggested !== right.category) return false;
  if (dateDistanceInDays(left.publishedAt, right.publishedAt) > 21) return false;
  const leftNormalized = normalizedTitle(left.title);
  const rightNormalized = normalizedTitle(right.title);
  if (leftNormalized && leftNormalized === rightNormalized) return true;
  const leftTokens = topicTokens(left.title);
  const rightTokens = topicTokens(right.title);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared >= 2 && topicSimilarity(left.title, right.title) >= 0.6;
}

export function findCanonicalTopicMatch(records, candidate) {
  return records.find((record) => sameTopic(candidate, record)) || null;
}
