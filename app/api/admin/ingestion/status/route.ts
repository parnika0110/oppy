import { NextResponse } from "next/server";
import { getIngestionRunsCollection, getOpportunitiesCollection, getDb } from "@/lib/mongodb";
import { isAdminRequest } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * GET /api/admin/ingestion/status
 * Returns recent ingestion run telemetry + live opportunity counts.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const [runsCollection, opportunitiesCollection, db] = await Promise.all([
      getIngestionRunsCollection(),
      getOpportunitiesCollection(),
      getDb(),
    ]);

    // Recent ingestion runs
    const recentRuns = await runsCollection
      .find({})
      .sort({ startedAt: -1 })
      .limit(20)
      .toArray();

    // Live counts from opportunities collection
    const [activeCount, closedCount, total] = await Promise.all([
      opportunitiesCollection.countDocuments({ lifecycleStatus: "active" }),
      opportunitiesCollection.countDocuments({ lifecycleStatus: "closed" }),
      opportunitiesCollection.countDocuments({}),
    ]);

    // Candidate counts
    const candidateCount = await db.collection("discoveryCandidates").countDocuments({ validationState: "pending" });

    // Closing soon (active items with deadline in next 7 days)
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const closingSoon = await opportunitiesCollection.countDocuments({
      lifecycleStatus: "active",
      $or: [
        { deadline: { $gte: now, $lte: sevenDays } },
        { applicationDeadline: { $gte: now, $lte: sevenDays } },
      ],
    });

    // New today
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const newToday = await opportunitiesCollection.countDocuments({
      createdAt: { $gte: startOfDay },
    });

    const totalFetched = recentRuns.reduce((s, r) => s + (r.fetched || 0), 0);
    const totalInserted = recentRuns.reduce((s, r) => s + (r.inserted || 0), 0);
    const totalSkipped = recentRuns.reduce((s, r) => s + (r.skipped || 0), 0);
    const totalFailed = recentRuns.reduce((s, r) => s + (r.failed || 0), 0);

    const serialized = recentRuns.map((r) => ({ ...r, _id: r._id.toString() }));

    return NextResponse.json({
      summary: {
        active: activeCount,
        closed: closedCount,
        candidates: candidateCount,
        total,
        closingSoon,
        newToday,
      },
      lastRun: serialized[0] || null,
      totalFetched,
      totalInserted,
      totalSkipped,
      totalFailed,
      recentRuns: serialized,
    });
  } catch (error) {
    console.error("[Admin] Failed to fetch ingestion status:", error);
    return NextResponse.json({ error: "Failed to fetch ingestion status" }, { status: 500 });
  }
}
