import { getDb } from "@/lib/mongodb";
import { BraveSearchDiscoverySource } from "./search";
import { GitHubDiscoverySource } from "./github";
import { RssDiscoverySource } from "./rss";
import { DiscoveryCandidate, DiscoverySource } from "./contracts";
import { assessCandidate } from "./quality";
import { canonicalUrl, contentHash, normalizedText } from "./normalize";

export interface DiscoverySourceResult {
  source: string;
  received: number;
  created: number;
  skipped: number;
  rejected: number;
  examples: Array<{ title: string; url: string; candidateType: string; state: string }>;
  error?: string;
}
export interface DiscoveryResult { discovered: number; created: number; skipped: number; rejected: number; errors: string[]; sourceResults: DiscoverySourceResult[]; }

const sources: DiscoverySource[] = [new RssDiscoverySource(), new GitHubDiscoverySource(), new BraveSearchDiscoverySource()];

export async function runDiscoveryPipeline(): Promise<DiscoveryResult> {
  const db = await getDb();
  const candidates = db.collection("discoveryCandidates");
  const runs = db.collection("discoveryRuns");
  const startedAt = new Date();
  const result: DiscoveryResult = { discovered: 0, created: 0, skipped: 0, rejected: 0, errors: [], sourceResults: [] };

  for (const source of sources) {
    try {
      const found = await source.discover(); result.discovered += found.length;
      const before = { created: result.created, skipped: result.skipped, rejected: result.rejected };
      for (const raw of found) await storeCandidate(candidates, raw, result);
      result.sourceResults.push({ source: source.name, received: found.length, created: result.created - before.created, skipped: result.skipped - before.skipped, rejected: result.rejected - before.rejected, examples: found.slice(0, 3).map((candidate) => ({ title: candidate.title, url: candidate.url, candidateType: candidate.candidateType, state: assessCandidate(candidate).state })) });
      await db.collection("sourceRegistry").updateOne({ name: source.name }, { $set: { name: source.name, lastSuccessAt: new Date(), lastError: null, enabled: true } }, { upsert: true });
    } catch (error) {
      const message = `${source.name}: ${String(error)}`; result.errors.push(message);
      result.sourceResults.push({ source: source.name, received: 0, created: 0, skipped: 0, rejected: 0, examples: [], error: message });
      await db.collection("sourceRegistry").updateOne({ name: source.name }, { $set: { name: source.name, lastFailureAt: new Date(), lastError: message, enabled: true } }, { upsert: true });
    }
  }
  await runs.insertOne({ type: "discovery", startedAt, completedAt: new Date(), ...result });
  return result;
}

async function storeCandidate(collection: ReturnType<Awaited<ReturnType<typeof getDb>>["collection"]>, raw: DiscoveryCandidate, result: DiscoveryResult) {
  const url = canonicalUrl(raw.url);
  if (!url) { result.rejected++; return; }
  const quality = assessCandidate({ ...raw, url });
  const hash = contentHash([raw.title, raw.organization, raw.description, url]);
  const existing = await collection.findOne({ $or: [{ canonicalUrl: url }, { sourceId: raw.sourceId }, { contentHash: hash }] });
  if (existing) { await collection.updateOne({ _id: existing._id }, { $set: { lastSeenAt: new Date(), evidence: raw.evidence } }); result.skipped++; return; }
  await collection.insertOne({ ...raw, canonicalUrl: url, normalizedTitle: normalizedText(raw.title), normalizedOrganization: normalizedText(raw.organization), contentHash: hash, validationState: quality.state, rejectionReason: quality.reasons, firstSeenAt: new Date(), lastSeenAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  if (quality.state === "rejected") result.rejected++; else result.created++;
}
