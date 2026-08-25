import { getOpportunitiesCollection, getIngestionRunsCollection } from "@/lib/mongodb";
import { RawOpportunity, OpportunitySource, IngestionRun } from "@/types/opportunity";

// Source adapters
import { DevfolioSource } from "./sources/devfolio";
import { DevpostSource } from "./sources/devpost";
import { GitHubProgramsSource } from "./sources/github-programs";
import { StaticProgramsSource } from "./sources/static-programs";

// ── Registry of all active sources ──────────────────────────────────────────
const ALL_SOURCES: OpportunitySource[] = [
  new DevfolioSource(),
  new DevpostSource(),
  new GitHubProgramsSource(),
  new StaticProgramsSource(),
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

  if (sources.length === 0) {
    throw new Error(`No source found matching "${sourceName}". Available: ${ALL_SOURCES.map((s) => s.name).join(", ")}`);
  }

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
            // Update lastSeenAt to signal freshness
            await collection.updateOne(
              { _id: exists._id },
              { $set: { lastSeenAt: new Date() } }
            );
            result.skipped++;
            continue;
          }

          // ── Insert immediately (no blocking AI enrichment) ──
          // Opportunities are inserted with raw data right away so ingestion
          // stays fast (seconds, not minutes). AI enrichment can be triggered
          // separately via /api/admin/enrich once data is in.
          const now = new Date();
          await collection.insertOne({
            title: raw.title,
            organization: raw.organization,
            category: raw.category,
            location: raw.location,
            tags: raw.tags || [],
            description: raw.description,
            applicationLink: raw.applicationLink,
            imageUrl: raw.imageUrl || null,
            deadline: raw.deadline ? new Date(raw.deadline) : null,
            deadlineKind: raw.deadline ? raw.deadlineKind || "source_provided" : "unavailable",
            deadlineLastVerifiedAt: raw.deadline ? now : null,
            source: raw.source || source.name,
            sourceUrl: raw.sourceUrl || raw.applicationLink,
            sourcePlatform: raw.sourcePlatform,
            sourceId: raw.sourceId || null,
            firstSeenAt: now,
            lastSeenAt: now,
            aiSummary: null,
            categoryValidation: null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });

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

  const pipelineResult: PipelineResult = {
    totalFetched: sourceResults.reduce((s, r) => s + r.fetched, 0),
    totalInserted: sourceResults.reduce((s, r) => s + r.inserted, 0),
    totalSkipped: sourceResults.reduce((s, r) => s + r.skipped, 0),
    totalFailed: sourceResults.reduce((s, r) => s + r.failed, 0),
    sourceResults,
    durationMs: Date.now() - pipelineStart,
  };

  console.log(
    `\n[Ingestion] ══ Pipeline Complete ══\n` +
    `  Total Fetched:  ${pipelineResult.totalFetched}\n` +
    `  Total Inserted: ${pipelineResult.totalInserted}\n` +
    `  Total Skipped:  ${pipelineResult.totalSkipped}\n` +
    `  Total Failed:   ${pipelineResult.totalFailed}\n` +
    `  Duration:       ${pipelineResult.durationMs}ms`
  );

  return pipelineResult;
}
