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

// ── Event detection ─────────────────────────────────────────────────────────

/**
 * Detect whether the event is an AWS EventBridge/Scheduler event.
 *
 * EventBridge Scheduler sends events with this shape:
 * {
 *   "version": "0",
 *   "id": "...",
 *   "detail-type": "Scheduled Event",
 *   "source": "aws.schedule",
 *   "account": "...",
 *   "time": "...",
 *   "region": "...",
 *   "resources": ["arn:aws:scheduler:..."],
 *   "detail": {}
 * }
 *
 * Direct invocations (manual/admin) send:
 * { "source": "Devfolio" } or { "forceAll": true }
 */
function isEventBridgeEvent(event: Record<string, unknown>): boolean {
  // EventBridge events always have "version" and "detail-type" fields
  // that our custom LambdaEvent interface does not use.
  return (
    typeof event["detail-type"] === "string" ||
    typeof event["version"] === "string" ||
    event["source"] === "aws.schedule"
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape expected by the handler when invoked directly (manual/admin). */
interface DirectInvocationEvent {
  /** Run a single source by name (optional) */
  source?: string;
  /** Override: run ALL sources regardless of scheduling (optional) */
  forceAll?: boolean;
}

/** Shape of an AWS EventBridge/Scheduler event. */
interface EventBridgeEvent {
  version: string;
  id: string;
  "detail-type": string;
  source: string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: Record<string, unknown>;
}

type LambdaEvent = DirectInvocationEvent | EventBridgeEvent | Record<string, unknown>;

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

// ── Handler ────────────────────────────────────────────────────────────────

export async function handler(event: LambdaEvent = {}): Promise<LambdaResult> {
  const runId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[IngestionLambda] ── Run ${runId} started at ${new Date().toISOString()}`);
  console.log(`[IngestionLambda] Event:`, JSON.stringify(event));

  try {
    const { runIngestionPipeline } = await getPipeline();

    // ── Determine what to run ────────────────────────────────────────────
    //
    // EventBridge/Scheduler events: run ALL sources (respecting source-aware scheduling).
    // Direct invocation with source name: run that specific source.
    // Direct invocation with forceAll: run ALL sources, ignore scheduling.
    // No event / empty event: run ALL sources (default behavior).

    const eventRecord = event as Record<string, unknown>;
    let sourceName: string | undefined;
    let forceAll = false;

    if (isEventBridgeEvent(eventRecord)) {
      // EventBridge Scheduler — run the full pipeline with source-aware scheduling.
      // Do NOT pass event.source ("aws.schedule") as a source name.
      console.log(`[IngestionLambda] Detected EventBridge event — running full pipeline`);
      sourceName = undefined;
      forceAll = false;
    } else {
      // Direct invocation — respect source/forceAll params
      const directEvent = event as DirectInvocationEvent;
      sourceName = directEvent.source || undefined;
      forceAll = directEvent.forceAll === true;
    }

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
