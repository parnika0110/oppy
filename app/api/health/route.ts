/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and deployment verification.
 * Returns database connectivity, ingestion status, and opportunity counts.
 * No authentication required — this is a public monitoring endpoint.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let status = "ok";

  // ── Database check ────────────────────────────────────────────
  try {
    const { getOpportunitiesCollection } = await import("@/lib/mongodb");
    const col = await getOpportunitiesCollection();

    const [total, active, closed, archived] = await Promise.all([
      col.countDocuments(),
      col.countDocuments({ lifecycleStatus: "active" }),
      col.countDocuments({ lifecycleStatus: "closed" }),
      col.countDocuments({ lifecycleStatus: "archived" }),
    ]);

    checks.database = { status: "ok", total, active, closed, archived };
  } catch (err) {
    checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
    status = "degraded";
  }

  // ── Sarvam check (config only, no API call) ──────────────────
  checks.sarvam = {
    status: process.env.SARVAM_API_KEY ? "configured" : "not_configured",
    mockMode: process.env.SARVAM_MOCK === "true",
  };

  // ── Cron check ────────────────────────────────────────────────
  checks.cron = {
    status: process.env.CRON_SECRET ? "configured" : "not_configured",
  };

  const httpStatus = status === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      responseTimeMs: Date.now() - startTime,
    },
    { status: httpStatus }
  );
}
