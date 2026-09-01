import { getOpportunitiesCollection, getIngestionRunsCollection, getDb } from "@/lib/mongodb";
import { RawOpportunity, OpportunitySource, IngestionRun } from "@/types/opportunity";
import { isSourceOverdue, getSourceInterval } from "./scheduler";

// Source adapters — Hackathons & Events
import { DevfolioSource } from "./sources/devfolio";
import { DevpostSource } from "./sources/devpost";
import { LumaSource } from "./sources/luma";
import { EventbriteSource } from "./sources/eventbrite";

// Source adapters — Jobs & Internships
import { JSearchSource } from "./sources/jsearch";
import { LinkedInSource } from "./sources/linkedin";
import { IndeedSource } from "./sources/indeed";
import { GlassdoorSource } from "./sources/glassdoor";
import { NaukriSource } from "./sources/naukri";
import { InternshalaSource } from "./sources/internshala";
import { RemoteOKSource } from "./sources/remoteok";

// Source adapters — Startups & Programs
import { YCStartupsSource } from "./sources/yc-startups";
import { HackerNewsSource } from "./sources/hackernews";
import { WellfoundSource } from "./sources/wellfound";
import { UnstopSource } from "./sources/unstop";

// Source adapters — RSS & Aggregation
import { RssFeedSource } from "./sources/rss-feeds";

import { runDiscoveryPipeline } from "@/lib/discovery";
import { refreshOpportunityLifecycle } from "@/lib/lifecycle";
import { scoreOpportunity } from "@/lib/discovery/rank";
import { fetchOpenGraphImage, resolveImageUrl } from "@/lib/images";
import { cleanIngestedText } from "@/lib/html-entities";

// ── Source refresh intervals (in milliseconds) ──────────────────────────────
// Used by admin dashboard to show freshness and by ingestion scheduling.
export const SOURCE_REFRESH_INTERVALS: Record<string, number> = {
  "Hacker News": 60 * 60 * 1000,            // 1 hour — fast-changing
  "JSearch": 3 * 60 * 60 * 1000,            // 3 hours — job boards
  "LinkedIn": 3 * 60 * 60 * 1000,
  "Indeed": 3 * 60 * 60 * 1000,
  "Glassdoor": 3 * 60 * 60 * 1000,
  "Naukri": 3 * 60 * 60 * 1000,
  "Internshala": 4 * 60 * 60 * 1000,        // 4 hours — internships
  "RemoteOK": 3 * 60 * 60 * 1000,           // 3 hours — remote jobs
  "Eventbrite": 6 * 60 * 60 * 1000,         // 6 hours — events
  "Devpost": 6 * 60 * 60 * 1000,            // 6 hours — hackathons
  "Devfolio": 6 * 60 * 60 * 1000,           // 6 hours — hackathons
  "Unstop": 6 * 60 * 60 * 1000,             // 6 hours — competitions
  "GitHub": 12 * 60 * 60 * 1000,            // 12 hours — OSS/programs
  "YCStartups": 12 * 60 * 60 * 1000,        // 12 hours — startups
  "Wellfound": 12 * 60 * 60 * 1000,         // 12 hours — startups
  "Luma": 6 * 60 * 60 * 1000,              // 6 hours — events
  "RssFeedSource": 6 * 60 * 60 * 1000,      // 6 hours — RSS feeds
};

// ── Registry of all active sources ──────────────────────────────────────────
// Each source auto-skips if its required API key is missing (returns []).
const ALL_SOURCES: OpportunitySource[] = [
  // ── Hackathons & Events ────────────────────────────────────────────────
  new DevfolioSource(),    // MLH + Devfolio hackathons (no auth)
  new DevpostSource(),     // Devpost hackathons (no auth)
  new LumaSource(),        // Luma events (needs LUMA_CALENDARS)
  new EventbriteSource(),  // Eventbrite events (no auth)
  new UnstopSource(),      // Unstop/D2C competitions (no auth)
  // ── Jobs & Internships ─────────────────────────────────────────────────
  new JSearchSource(),     // Aggregated: LinkedIn/Indeed/Glassdoor/Naukri (needs RAPIDAPI_KEY)
  new LinkedInSource(),    // LinkedIn Jobs via JSearch (needs RAPIDAPI_KEY)
  new IndeedSource(),      // Indeed Jobs via JSearch (needs RAPIDAPI_KEY)
  new GlassdoorSource(),   // Glassdoor Jobs via JSearch (needs RAPIDAPI_KEY)
  new NaukriSource(),      // Naukri direct scrape (no auth)
  new InternshalaSource(), // Internshala 8 categories (no auth)
  new RemoteOKSource(),    // RemoteOK remote jobs (no auth)
  // ── Startups & Programs ────────────────────────────────────────────────
  new YCStartupsSource(),  // YC Work at a Startup (no auth)
  new HackerNewsSource(),  // HN Who's Hiring (no auth)
  new WellfoundSource(),   // Wellfound/AngelList via JSearch (needs RAPIDAPI_KEY)
  // ── RSS & Aggregation ──────────────────────────────────────────────────
  new RssFeedSource(),     // 15+ RSS feeds from job boards, communities, blogs
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
  lockAcquired?: boolean;
  sourcesSkipped?: string[];
}

// ── Escape regex special chars in titles ─────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Core Pipeline ───────────────────────────────────────────────────────────

// ── Concurrency Lock ────────────────────────────────────────────────────────
// Prevents overlapping ingestion runs. Uses a MongoDB document as a simple lock.
// The lock has a TTL so a crashed run doesn't permanently block future runs.

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes — generous for slow runs
const LOCK_COLLECTION = "ingestionLock";

async function acquireLock(): Promise<boolean> {
  const db = await getDb();
  const lockCol = db.collection(LOCK_COLLECTION);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);
  // Unique token so we can verify ownership after the atomic upsert.
  const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Atomic acquire via a single findOneAndUpdate with upsert:
  //
  //  • If no document exists → filter doesn't match → upsert inserts a new doc ✅
  //  • If document exists but expiresAt ≤ now (expired) → filter matches → upsert overwrites ✅
  //  • If document exists and expiresAt > now (active) → filter doesn't match →
  //    upsert tries to INSERT (no matched doc) → duplicate-key error on _id →
  //    we catch code 11000 and return false ✅
  //
  // This is race-safe: only one process can successfully match + upsert at a time.
  try {
    await lockCol.findOneAndUpdate(
      {
        _id: "pipeline" as any,
        expiresAt: { $lte: now },
      },
      {
        $set: { startedAt: now, expiresAt, lockId } as any,
      },
      { upsert: true }
    );
  } catch (err: any) {
    // Duplicate key = filter didn't match an active lock → another process holds it
    if (err?.code === 11000) return false;
    throw err;
  }

  // Defence-in-depth: verify we own the lock (should never fail in practice)
  const doc = await lockCol.findOne({ _id: "pipeline" as any });
  return (doc as any)?.lockId === lockId;
}

async function releaseLock(): Promise<void> {
  const db = await getDb();
  const lockCol = db.collection(LOCK_COLLECTION);
  await lockCol.deleteOne({ _id: "pipeline" as any });
}

/**
 * Run the full ingestion pipeline across all registered sources.
 * Optionally filter to a single source by name.
 *
 * When no sourceName is specified, respects source-specific refresh intervals:
 * sources that ran recently (within their configured interval) are skipped.
 * Pass sourceName to force-run a specific source regardless of timing.
 */
export async function runIngestionPipeline(sourceName?: string): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const isSingleSource = Boolean(sourceName);

  // ── Concurrency lock (only for full pipeline runs) ──────────────────────
  let lockAcquired = false;
  if (!isSingleSource) {
    lockAcquired = await acquireLock();
    if (!lockAcquired) {
      console.log("[Ingestion] Pipeline already running — skipping.");
      return {
        totalFetched: 0, totalInserted: 0, totalSkipped: 0, totalFailed: 0,
        sourceResults: [], durationMs: 0, lockAcquired: false, sourcesSkipped: [],
      };
    }
  }

  try {
    return await runPipelineInner(sourceName, pipelineStart);
  } finally {
    if (lockAcquired) {
      await releaseLock();
    }
  }
}

async function runPipelineInner(sourceName: string | undefined, pipelineStart: number): Promise<PipelineResult> {
  // ── Select sources ──────────────────────────────────────────────────────
  let sources: OpportunitySource[];
  const sourcesSkipped: string[] = [];

  if (sourceName) {
    // Force-run a specific source (from admin dashboard or manual trigger)
    sources = ALL_SOURCES.filter((s) => s.name.toLowerCase().includes(sourceName.toLowerCase()));
    if (sources.length === 0 && !"discovery".includes(sourceName.toLowerCase())) {
      throw new Error(`No source found matching "${sourceName}". Available: ${ALL_SOURCES.map((s) => s.name).join(", ")}`);
    }
  } else {
    // Full pipeline: only run sources that are overdue for refresh
    sources = [];
    const runsCollection = await getIngestionRunsCollection();

    for (const source of ALL_SOURCES) {
      // Find the most recent successful run for this source
      const lastRun = await runsCollection
        .findOne(
          { source: source.name },
          { sort: { completedAt: -1 } }
        );

      const lastRunIso = lastRun?.completedAt || null;

      if (isSourceOverdue(source.name, lastRunIso)) {
        sources.push(source);
      } else {
        sourcesSkipped.push(source.name);
      }
    }

    // Record telemetry for skipped sources so admin dashboard can distinguish
    // "skipped (not due)" from "never ran" from "failed".
    if (sourcesSkipped.length > 0) {
      const skippedEntries = sourcesSkipped.map((name) => ({
        source: name,
        status: "skipped" as const,
        reason: "not_due" as const,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        fetched: 0, inserted: 0, skipped: 0, failed: 0,
        durationMs: 0,
        errors: [] as string[],
      }));
      await runsCollection.insertMany(skippedEntries);
      console.log(`[Ingestion] Recorded telemetry for ${sourcesSkipped.length} skipped sources.`);
    }

    if (sources.length === 0) {
      console.log("[Ingestion] All sources are up to date — nothing to do.");
      return {
        totalFetched: 0, totalInserted: 0, totalSkipped: 0, totalFailed: 0,
        sourceResults: [], durationMs: Date.now() - pipelineStart,
        lockAcquired: true, sourcesSkipped,
      };
    }

    console.log(`[Ingestion] Running ${sources.length} overdue sources, skipping ${sourcesSkipped.length} up-to-date sources.`);
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
            const updates: Record<string, unknown> = { lastSeenAt: new Date(), updatedAt: new Date(), lastUpdatedAt: new Date() };

            // Backfill or refresh image from fresh source data.
            // Also refresh if the existing imageUrl is from a different source
            // (e.g. we now have a better one from Devpost vs Devfolio).
            if (raw.imageUrl && (!exists.imageUrl || exists.sourcePlatform !== raw.sourcePlatform)) {
              updates.imageUrl = raw.imageUrl;
            }
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
            title: cleanIngestedText(raw.title),
            organization: cleanIngestedText(raw.organization),
            category: raw.category,
            location: cleanIngestedText(raw.location),
            tags: (raw.tags || []).map(cleanIngestedText).filter(Boolean),
            description: cleanIngestedText(raw.description),
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
            source: cleanIngestedText(raw.source) || source.name,
            sourceUrl: raw.sourceUrl || raw.applicationLink,
            sourcePlatform: raw.sourcePlatform,
            sourceId: raw.sourceId || null,
            // Lifecycle
            lifecycleStatus: "active",
            isActive: true,
            // Timestamps
            firstSeenAt: now,
            lastSeenAt: now,
            lastUpdatedAt: now,
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
    const hasErrors = result.errors.length > 0 || result.failed > 0;
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
      status: hasErrors ? "error" : "success",
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

  // ── Fetch OpenGraph images for opportunities missing imageUrl ────────────
  let ogImagesFetched = 0;
  try {
    ogImagesFetched = await backfillOpenGraphImages(collection);
    console.log(`[Ingestion] Backfilled ${ogImagesFetched} OpenGraph images.`);
  } catch (err) {
    console.error("[Ingestion] OG image backfill failed:", err);
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
    lockAcquired: true,
    sourcesSkipped,
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

// ── OpenGraph image backfill ─────────────────────────────────────────────────

/**
 * Find active opportunities missing imageUrl and try to fetch one from
 * the opportunity's page via OpenGraph meta tags.
 * Only processes opportunities with a valid applicationLink or sourceUrl.
 * Rate-limited: processes at most 10 per ingestion run.
 */
async function backfillOpenGraphImages(collection: any): Promise<number> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find active opportunities without imageUrl that have a URL to fetch
  const missing = await collection
    .find({
      imageUrl: { $in: [null, undefined, ""] },
      lifecycleStatus: "active",
      $or: [
        { applicationLink: { $exists: true, $nin: [null, ""] } },
        { sourceUrl: { $exists: true, $nin: [null, ""] } },
      ],
    })
    .sort({ opportunityScore: -1, createdAt: -1 })
    .limit(10) // Only try 10 per run to avoid rate limiting
    .toArray();

  if (missing.length === 0) return 0;

  let fetched = 0;
  for (const opp of missing) {
    const pageUrl = opp.applicationLink || opp.sourceUrl;
    if (!pageUrl || !pageUrl.startsWith("http")) continue;

    try {
      const ogImage = await fetchOpenGraphImage(pageUrl, 6000);
      if (ogImage) {
        await collection.updateOne(
          { _id: opp._id },
          { $set: { imageUrl: ogImage, updatedAt: new Date() } }
        );
        fetched++;
        console.log(`[Ingestion] OG image found for: ${opp.title?.substring(0, 50)}`);
      }
      // Polite delay between requests
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // Silently skip — OG fetch is best-effort
    }
  }

  return fetched;
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
