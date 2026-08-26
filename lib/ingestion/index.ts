import { getOpportunitiesCollection, getIngestionRunsCollection, getDb } from "@/lib/mongodb";
import { RawOpportunity, OpportunitySource, IngestionRun } from "@/types/opportunity";

// Source adapters
import { DevfolioSource } from "./sources/devfolio";
import { DevpostSource } from "./sources/devpost";
import { InternshalaSource } from "./sources/internshala";
import { LumaSource } from "./sources/luma";
import { JSearchSource } from "./sources/jsearch";

import { runDiscoveryPipeline } from "@/lib/discovery";
import { refreshOpportunityLifecycle } from "@/lib/lifecycle";
import { scoreOpportunity } from "@/lib/discovery/rank";

// ── Registry of all active sources ──────────────────────────────────────────
const ALL_SOURCES: OpportunitySource[] = [
  new DevfolioSource(),
  new DevpostSource(),
  new InternshalaSource(),
  new LumaSource(),
  new JSearchSource(), // Real JSearch — returns [] if RAPIDAPI_KEY not configured
];

// ── Result Types ────────────────────────────────────────────────────────────

export interface SourceResult {
  source: string;
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

export interface PipelineResult {
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  totalFailed: number;
  sourceResults: SourceResult[];
  durationMs: number;
  discovery?: { discovered: number; created: number; skipped: number; rejected: number; errors: string[] };
  promoted?: number;
}

// ── Escape regex special chars in titles ─────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Core Pipeline ───────────────────────────────────────────────────────────

/**
 * Run the full ingestion pipeline across all registered sources.
 * Optionally filter to a single source by name.
 */
export async function runIngestionPipeline(sourceName?: string): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const sources = sourceName
    ? ALL_SOURCES.filter((s) => s.name.toLowerCase().includes(sourceName.toLowerCase()))
    : ALL_SOURCES;

  if (sources.length === 0 && sourceName && !"discovery".includes(sourceName.toLowerCase())) {
    throw new Error(`No source found matching "${sourceName}". Available: ${ALL_SOURCES.map((s) => s.name).join(", ")}`);
  }

  // Refresh lifecycle before ingestion (close expired opportunities)
  await refreshOpportunityLifecycle();

  // Run discovery pipeline (candidate-only — candidates go into discoveryCandidates collection)
  const discovery = !sourceName || sourceName.toLowerCase().includes("discovery")
    ? await runDiscoveryPipeline()
    : undefined;

  const collection = await getOpportunitiesCollection();
  const runsCollection = await getIngestionRunsCollection();
  const sourceResults: SourceResult[] = [];

  for (const source of sources) {
    const sourceStart = Date.now();
    const result: SourceResult = {
      source: source.name,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
    };

    console.log(`\n[Ingestion] ── ${source.name} ──────────────────────`);

    try {
      // 1. Fetch
      const rawItems = await source.fetch();
      result.fetched = rawItems.length;
      console.log(`[Ingestion] ${source.name}: Fetched ${rawItems.length} items.`);

      // 2. Process each item
      for (const raw of rawItems) {
        try {
          // ── Cascading Deduplication ──
          // Priority 1: sourceUrl match
          let exists = raw.sourceUrl
            ? await collection.findOne({ sourceUrl: raw.sourceUrl })
            : null;

          // Priority 2: sourceId + sourcePlatform match
          if (!exists && raw.sourceId) {
            exists = await collection.findOne({
              sourceId: raw.sourceId,
              sourcePlatform: raw.sourcePlatform,
            });
          }

          // Priority 3: title + organization (fuzzy)
          if (!exists) {
            exists = await collection.findOne({
              title: { $regex: new RegExp(`^${escapeRegex(raw.title)}$`, "i") },
              organization: { $regex: new RegExp(`^${escapeRegex(raw.organization)}$`, "i") },
            });
          }

          if (exists) {
            // Update with any newly discovered data (images, dates, etc.)
            const updates: Record<string, unknown> = { lastSeenAt: new Date(), updatedAt: new Date() };

            // Backfill missing fields from fresh source data
            if (!exists.imageUrl && raw.imageUrl) updates.imageUrl = raw.imageUrl;
            if (!exists.eventDate && (raw as any).eventDate) updates.eventDate = new Date((raw as any).eventDate);
            if (!exists.eventEndDate && (raw as any).eventEndDate) updates.eventEndDate = new Date((raw as any).eventEndDate);
            if (!exists.registrationDeadline && (raw as any).registrationDeadline) updates.registrationDeadline = new Date((raw as any).registrationDeadline);
            if ((!exists.deadline || exists.deadlineKind === "unavailable") && raw.deadline) {
              updates.deadline = new Date(raw.deadline as string | number);
              updates.deadlineKind = raw.deadlineKind || "source_provided";
            }
            // Fix "Other" sourcePlatform if we now have a better one
            if (exists.sourcePlatform === "Other" && raw.sourcePlatform !== "Other") {
              updates.sourcePlatform = raw.sourcePlatform;
            }

            await collection.updateOne({ _id: exists._id }, { $set: updates });
            result.skipped++;
            continue;
          }

          // ── Insert new opportunity ──
          const now = new Date();
          const extended = raw as any;

          const doc: Record<string, unknown> = {
            title: raw.title,
            organization: raw.organization,
            category: raw.category,
            location: raw.location,
            tags: raw.tags || [],
            description: raw.description,
            applicationLink: raw.applicationLink,
            imageUrl: raw.imageUrl || null,
            imageAlt: raw.imageUrl ? `${raw.title} image` : null,
            deadline: raw.deadline ? new Date(raw.deadline as string | number) : null,
            deadlineKind: raw.deadline ? raw.deadlineKind || "source_provided" : "unavailable",
            deadlineLastVerifiedAt: raw.deadline ? now : null,
            // Extended date fields
            eventDate: extended.eventDate ? new Date(extended.eventDate) : null,
            eventEndDate: extended.eventEndDate ? new Date(extended.eventEndDate) : null,
            registrationDeadline: extended.registrationDeadline ? new Date(extended.registrationDeadline) : null,
            applicationDeadline: raw.deadline ? new Date(raw.deadline as string | number) : null,
            // Source tracking
            source: raw.source || source.name,
            sourceUrl: raw.sourceUrl || raw.applicationLink,
            sourcePlatform: raw.sourcePlatform,
            sourceId: raw.sourceId || null,
            // Lifecycle
            lifecycleStatus: "active",
            isActive: true,
            // Timestamps
            firstSeenAt: now,
            lastSeenAt: now,
            discoveredAt: now,
            createdAt: now,
            updatedAt: now,
            // Empty slots for later enrichment
            aiSummary: null,
            categoryValidation: null,
          };

          // Score the opportunity
          const completeness = calculateCompleteness(doc);
          const scores = scoreOpportunity({
            trustTier: "platform",
            completeness,
            deadlineKind: doc.deadlineKind as string,
          });
          doc.qualityScore = scores.qualityScore;
          doc.opportunityScore = scores.opportunityScore;
          doc.scoreVersion = scores.scoreVersion;

          await collection.insertOne(doc);

          result.inserted++;
          console.log(`[Ingestion] ✓ Inserted: ${raw.title.substring(0, 60)}`);
        } catch (itemErr) {
          result.failed++;
          const errMsg = `${raw.title}: ${String(itemErr).substring(0, 150)}`;
          result.errors.push(errMsg);
          console.error(`[Ingestion] ✗ Failed: ${errMsg}`);
        }
      }
    } catch (sourceErr) {
      const errMsg = `Source fetch failed: ${String(sourceErr).substring(0, 200)}`;
      result.errors.push(errMsg);
      console.error(`[Ingestion] ${source.name}: ${errMsg}`);
    }

    result.durationMs = Date.now() - sourceStart;
    console.log(
      `[Ingestion] ${source.name}: Done. ` +
      `Fetched=${result.fetched} Inserted=${result.inserted} Skipped=${result.skipped} Failed=${result.failed} ` +
      `(${result.durationMs}ms)`
    );

    // ── Save run telemetry ──
    const runDoc: IngestionRun = {
      startedAt: new Date(sourceStart).toISOString(),
      completedAt: new Date().toISOString(),
      source: source.name,
      fetched: result.fetched,
      inserted: result.inserted,
      skipped: result.skipped,
      failed: result.failed,
      durationMs: result.durationMs,
      errors: result.errors,
    };
    await runsCollection.insertOne(runDoc);

    sourceResults.push(result);
  }

  // ── Promote approved discovery candidates to opportunities ───────────────
  let promoted = 0;
  try {
    promoted = await promoteApprovedCandidates();
    console.log(`[Ingestion] Promoted ${promoted} discovery candidates to opportunities.`);
  } catch (err) {
    console.error("[Ingestion] Candidate promotion failed:", err);
  }

  const pipelineResult: PipelineResult = {
    totalFetched: sourceResults.reduce((s, r) => s + r.fetched, 0),
    totalInserted: sourceResults.reduce((s, r) => s + r.inserted, 0),
    totalSkipped: sourceResults.reduce((s, r) => s + r.skipped, 0),
    totalFailed: sourceResults.reduce((s, r) => s + r.failed, 0),
    sourceResults,
    durationMs: Date.now() - pipelineStart,
    discovery,
    promoted,
  };

  console.log(
    `\n[Ingestion] ══ Pipeline Complete ══\n` +
    `  Total Fetched:  ${pipelineResult.totalFetched}\n` +
    `  Total Inserted: ${pipelineResult.totalInserted}\n` +
    `  Total Skipped:  ${pipelineResult.totalSkipped}\n` +
    `  Total Failed:   ${pipelineResult.totalFailed}\n` +
    `  Promoted:       ${promoted}\n` +
    `  Duration:       ${pipelineResult.durationMs}ms`
  );

  return pipelineResult;
}

// ── Promote approved discovery candidates → opportunities ────────────────────

async function promoteApprovedCandidates(): Promise<number> {
  const db = await getDb();
  const candidates = db.collection("discoveryCandidates");
  const opportunities = await getOpportunitiesCollection();

  const approved = await candidates.find({
    validationState: "approved",
    promotedAt: { $exists: false },
  }).toArray();

  let promoted = 0;

  for (const candidate of approved) {
    try {
      // Dedup check against existing opportunities
      const url = candidate.canonicalUrl || candidate.url;
      const existing = await opportunities.findOne({
        $or: [
          { sourceUrl: url },
          { applicationLink: url },
          {
            title: { $regex: new RegExp(`^${escapeRegex(candidate.title)}$`, "i") },
            organization: { $regex: new RegExp(`^${escapeRegex(candidate.organization)}$`, "i") },
          },
        ],
      });

      if (existing) {
        // Already exists — mark as promoted without creating duplicate
        await candidates.updateOne({ _id: candidate._id }, { $set: { promotedAt: new Date(), promotedToId: existing._id } });
        continue;
      }

      const now = new Date();
      const completeness = calculateCompleteness(candidate);
      const scores = scoreOpportunity({
        trustTier: candidate.trustTier || "unknown",
        completeness,
        deadlineKind: candidate.deadlineKind,
      });

      const doc = {
        title: candidate.title,
        organization: candidate.organization,
        category: candidate.category || "Event",
        location: candidate.location || (candidate.isRemote ? "Remote" : "Online"),
        tags: candidate.tags || [],
        description: candidate.description || "",
        applicationLink: candidate.applicationUrl || candidate.eventUrl || url,
        imageUrl: candidate.imageUrl || null,
        imageAlt: candidate.imageUrl ? `${candidate.title} image` : null,
        deadline: candidate.deadline || null,
        deadlineKind: candidate.deadlineKind || "unavailable",
        eventDate: candidate.eventDate || null,
        eventEndDate: candidate.eventEndDate || null,
        applicationDeadline: candidate.applicationDeadline || null,
        registrationDeadline: candidate.registrationDeadline || null,
        city: candidate.city || null,
        country: candidate.country || null,
        isRemote: candidate.isRemote || false,
        source: candidate.discoveredFrom || null,
        sourceUrl: url,
        sourcePlatform: candidate.sourcePlatform || "Other",
        sourceId: candidate.sourceId || null,
        discoveredFrom: candidate.discoveredFrom || null,
        discoveryMethod: candidate.discoveryMethod || null,
        sourceTrustTier: candidate.trustTier || "unknown",
        lifecycleStatus: "active",
        isActive: true,
        firstSeenAt: candidate.firstSeenAt || now,
        lastSeenAt: now,
        discoveredAt: candidate.firstSeenAt || now,
        createdAt: now,
        updatedAt: now,
        qualityScore: scores.qualityScore,
        opportunityScore: scores.opportunityScore,
        scoreVersion: scores.scoreVersion,
        aiSummary: null,
        categoryValidation: null,
      };

      const result = await opportunities.insertOne(doc);
      await candidates.updateOne({ _id: candidate._id }, { $set: { promotedAt: now, promotedToId: result.insertedId } });
      promoted++;
      console.log(`[Promotion] ✓ ${candidate.title.substring(0, 60)}`);
    } catch (err) {
      console.error(`[Promotion] ✗ ${candidate.title}: ${String(err).substring(0, 100)}`);
    }
  }

  return promoted;
}

// ── Completeness scoring ─────────────────────────────────────────────────────

function calculateCompleteness(doc: Record<string, unknown>): number {
  let score = 0;
  const max = 10;
  if (doc.title) score++;
  if (doc.organization) score++;
  if (doc.description && String(doc.description).length > 20) score++;
  if (doc.applicationLink || doc.applicationUrl || doc.sourceUrl) score++;
  if (doc.imageUrl) score++;
  if (doc.deadline || doc.applicationDeadline || doc.registrationDeadline) score++;
  if (doc.eventDate) score++;
  if (doc.location) score++;
  if (doc.category) score++;
  if (doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0) score++;
  return Math.round((score / max) * 100);
}
