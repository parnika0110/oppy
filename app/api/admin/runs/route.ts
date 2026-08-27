import { NextRequest, NextResponse } from "next/server";
import { getIngestionRunsCollection } from "@/lib/mongodb";
import { isAdminRequest } from "@/lib/auth";

/**
 * GET /api/admin/runs
 * Returns actual ingestion run history from the ingestionRuns collection.
 * Protected by admin session authentication.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const runsCollection = await getIngestionRunsCollection();

    const runs = await runsCollection
      .find({})
      .sort({ startedAt: -1 })
      .limit(100)
      .toArray();

    const serialized = runs.map((r) => ({
      _id: r._id.toString(),
      source: r.source,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationMs: r.durationMs,
      fetched: r.fetched || 0,
      inserted: r.inserted || 0,
      skipped: r.skipped || 0,
      failed: r.failed || 0,
      errors: r.errors || [],
      // Derived fields for the UI
      status: (r.errors || []).length > 0 ? "error" : r.fetched > 0 ? "success" : "empty",
    }));

    return NextResponse.json({ runs: serialized });
  } catch (error) {
    console.error("[Admin] Failed to load runs:", error);
    return NextResponse.json({ error: "Failed to load run history." }, { status: 500 });
  }
}
