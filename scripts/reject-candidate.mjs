import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.GTA6_WATCH_DATA_DIR ? path.resolve(process.env.GTA6_WATCH_DATA_DIR) : path.join(root, "data");
const [candidateId, state, ...reasonParts] = process.argv.slice(2);
if (!candidateId || !["REJECTED", "DUPLICATE"].includes(state) || !reasonParts.join(" ").trim()) {
  throw new Error("Usage: node scripts/reject-candidate.mjs <candidateId> <REJECTED|DUPLICATE> <reason>");
}
const candidatesPath = path.join(dataDir, "candidates.json");
const candidatesDoc = JSON.parse(await fs.readFile(candidatesPath, "utf8"));
const candidate = candidatesDoc.candidates.find((item) => item.candidateId === candidateId);
if (!candidate) throw new Error(`Unknown candidate: ${candidateId}`);
if (candidate.reviewState !== "PENDING") throw new Error(`Candidate ${candidateId} is ${candidate.reviewState} and cannot be changed.`);
const timestamp = new Date().toISOString();
const reason = reasonParts.join(" ").trim();
candidate.reviewState = state;
candidate.reviewReason = reason;
candidate.reviewHistory.push({ state, reason, timestamp });
await fs.writeFile(candidatesPath, `${JSON.stringify(candidatesDoc, null, 2)}\n`);
console.log(`${candidateId} marked ${state}.`);
