/**
 * OPPY Ingestion Lambda Handler
 *
 * Standalone AWS Lambda function that runs the full ingestion pipeline.
 * Triggered by EventBridge Scheduler every 6 hours.
 *
 * Key difference from GET /api/cron/ingest:
 *   - Lambda timeout: 15 minutes (vs ~30s for Amplify HTTP routes)
 *   - No HTTP round-trip overhead
 *   - Direct EventBridge invocation
 *
 * Environment variables required:
 *   MONGODB_URI, MONGODB_DB, CRON_SECRET, RAPIDAPI_KEY,
 *   LUMA_CALENDARS, SARVAM_API_KEY, OPENAI_API_KEY,
 *   NEXT_PUBLIC_APP_URL
 *
 * @see lib/ingestion/index.ts — core pipeline logic
 * @see amplify.yml — Amplify frontend deployment (separate from this Lambda)
 */

import crypto from "crypto";

// ── Lazy imports (resolved at bundle time by esbuild) ──────────────────────
// We import the pipeline dynamically so the module graph is resolved during
// bundling rather than at cold-start, keeping the handler thin.

let _pipelinePromise: Promise<typeof import("@/lib/ingestion")> | null = null;

async function getPipeline() {
  if (!_pipelinePromise) {
    _pipelinePromise = import("@/lib/ingestion");
  }
  return _pipelinePromise;
}

// ── Handler ────────────────────────────────────────────────────────────────

interface LambdaEvent {
  /** Run a single source by name (optional) */
  source?: string;
  /** Override: run ALL sources regardless of scheduling (optional) */
  forceAll?: boolean;
}

interface LambdaResult {
  success: boolean;
  message: string;
  data?: {
    totalFetched: number;
    totalInserted: number;
    totalSkipped: number;
    totalFailed: number;
    sourceResults: Array<{
      source: string;
      fetched: number;
      inserted: number;
      skipped: number;
      failed: number;
      durationMs: number;
      errors: string[];
    }>;
    durationMs: number;
    lockAcquired?: boolean;
    sourcesSkipped?: string[];
  };
  error?: string;
  runId: string;
}

export async function handler(event: LambdaEvent = {}): Promise<LambdaResult> {
  const runId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[IngestionLambda] ── Run ${runId} started at ${new Date().toISOString()}`);
  console.log(`[IngestionLambda] Event:`, JSON.stringify(event));

  try {
    const { runIngestionPipeline } = await getPipeline();

    const sourceName = event.source || undefined;
    const forceAll = event.forceAll === true;

    // When forceAll is set, skip source-aware scheduling (run everything)
    // This is useful for initial seeding or emergency re-runs.
    const result = await runIngestionPipeline(forceAll ? undefined : sourceName);

    const durationMs = Date.now() - startTime;

    console.log(`[IngestionLambda] ── Run ${runId} completed in ${durationMs}ms`);
    console.log(`[IngestionLambda] Lock acquired: ${result.lockAcquired}`);
    console.log(`[IngestionLambda] Fetched: ${result.totalFetched}, Inserted: ${result.totalInserted}, Skipped: ${result.totalSkipped}, Failed: ${result.totalFailed}`);
    console.log(`[IngestionLambda] Sources skipped (not due): ${result.sourcesSkipped?.length || 0}`);

    if (result.sourceResults.length > 0) {
      for (const sr of result.sourceResults) {
        const status = sr.errors.length > 0 ? "ERROR" : "OK";
        console.log(`[IngestionLambda]   ${sr.source}: ${status} (fetched=${sr.fetched} inserted=${sr.inserted} skipped=${sr.skipped} failed=${sr.failed} ${sr.durationMs}ms)`);
      }
    }

    return {
      success: true,
      message: result.lockAcquired === false
        ? "Another ingestion run is already in progress."
        : `Ingestion completed. ${result.totalInserted} new, ${result.totalSkipped} updated, ${result.totalFailed} failed.`,
      data: result,
      runId,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error(`[IngestionLambda] ── Run ${runId} FAILED after ${durationMs}ms`);
    console.error(`[IngestionLambda] Error:`, errorMessage);

    return {
      success: false,
      message: `Ingestion failed: ${errorMessage}`,
      error: errorMessage,
      runId,
    };
  }
}
