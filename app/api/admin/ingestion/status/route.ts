import { NextResponse } from "next/server";
import { getIngestionRunsCollection } from "@/lib/mongodb";
import { isAdminRequest } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * GET /api/admin/ingestion/status
 * Returns recent ingestion run telemetry for the admin dashboard.
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const collection = await getIngestionRunsCollection();

    // Get the 20 most recent runs, sorted newest first
    const recentRuns = await collection
      .find({})
      .sort({ startedAt: -1 })
      .limit(20)
      .toArray();

    // Compute aggregate stats
    const totalFetched = recentRuns.reduce((s, r) => s + (r.fetched || 0), 0);
    const totalInserted = recentRuns.reduce((s, r) => s + (r.inserted || 0), 0);
    const totalSkipped = recentRuns.reduce((s, r) => s + (r.skipped || 0), 0);
    const totalFailed = recentRuns.reduce((s, r) => s + (r.failed || 0), 0);

    // Serialize _id
    const serialized = recentRuns.map((r) => ({
      ...r,
      _id: r._id.toString(),
    }));

    return NextResponse.json({
      lastRun: serialized[0] || null,
      totalFetched,
      totalInserted,
      totalSkipped,
      totalFailed,
      recentRuns: serialized,
    });
  } catch (error) {
    console.error("[Admin] Failed to fetch ingestion status:", error);
    return NextResponse.json(
      { error: "Failed to fetch ingestion status" },
      { status: 500 }
    );
  }
}
