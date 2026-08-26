import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { runIngestionPipeline } from "@/lib/ingestion";

export const maxDuration = 300;

/**
 * POST /api/admin/run-ingestion
 * Triggers the full ingestion pipeline from the admin dashboard.
 * Protected by cookie-based admin authentication.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    console.log("[Admin] Manual ingestion run triggered from dashboard.");
    const result = await runIngestionPipeline();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[Admin] Ingestion run failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed." },
      { status: 500 }
    );
  }
}
