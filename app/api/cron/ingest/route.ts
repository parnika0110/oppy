import { NextResponse } from "next/server";
import { runIngestionPipeline } from "@/lib/ingestion";
import { isCronRequest } from "@/lib/auth";

export const maxDuration = 300; // 5 minutes for Vercel Pro, 60s on hobby

/**
 * GET /api/cron/ingest
 * Triggered by Vercel Cron or manually from the admin dashboard.
 *
 * Query params:
 *   ?source=Devfolio  — run only a specific source adapter
 */
export async function GET(request: Request) {
  try {
    // Both scheduled and manual ingestion must be authenticated. This fails
    // closed when deployment secrets are missing instead of publishing a write endpoint.
    if (!(await isCronRequest(request))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Optional: run a single source
    const { searchParams } = new URL(request.url);
    const sourceName = searchParams.get("source") || undefined;

    console.log(`[CRON] Ingestion triggered. Source filter: ${sourceName || "ALL"}`);

    const result = await runIngestionPipeline(sourceName);

    // When the lock is held, the pipeline returns lockAcquired=false with zero counts.
    const wasSkipped = result.lockAcquired === false;

    return NextResponse.json({
      success: true,
      message: wasSkipped
        ? "Another ingestion run is already in progress."
        : "Ingestion pipeline completed.",
      data: result,
    });
  } catch (error) {
    console.error("[CRON] Ingestion failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
