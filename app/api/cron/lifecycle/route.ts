import { NextResponse } from "next/server";
import { refreshOpportunityLifecycle } from "@/lib/lifecycle";
import { isCronRequest } from "@/lib/auth";

export const maxDuration = 60; // 60 seconds — much lighter than full ingestion

/**
 * GET /api/cron/lifecycle
 *
 * Dedicated lifecycle automation endpoint. Runs automatically via AWS EventBridge
 * and can also be triggered manually from the admin dashboard.
 *
 * What it does:
 *   1. Closes expired opportunities (passed deadlines, ended events)
 *   2. Detects opportunities approaching their deadline (within 3 days)
 *   3. Returns structured results for monitoring
 *
 * Authentication:
 *   - Bearer CRON_SECRET (for EventBridge / automated triggers)
 *   - Admin session cookie (for manual admin triggers)
 *
 * Idempotency:
 *   Safe to run multiple times. Already-closed records are never touched.
 *   Archived records are never modified.
 *
 * Schedule recommendation:
 *   Every 6 hours via AWS EventBridge rule.
 *   This is lightweight (no network scraping) and can run independently
 *   of the heavier ingestion pipeline at /api/cron/ingest.
 */
export async function GET(request: Request) {
  try {
    if (!(await isCronRequest(request))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log("[CRON] Lifecycle automation triggered.");

    const result = await refreshOpportunityLifecycle();

    console.log(
      `[CRON] Lifecycle complete. Closed: ${result.closed}, ` +
      `Upcoming: ${result.upcoming.length}, ` +
      `Duration: ${result.durationMs}ms`
    );

    return NextResponse.json({
      success: true,
      message: "Lifecycle automation completed.",
      data: {
        closed: result.closed,
        upcomingCount: result.upcoming.length,
        upcoming: result.upcoming.slice(0, 20), // Cap response size
        checkedAt: result.checkedAt.toISOString(),
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    console.error("[CRON] Lifecycle failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
