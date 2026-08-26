import { NextRequest, NextResponse } from "next/server";
import { getIngestionRunsCollection } from "@/lib/mongodb";
import { isAdminRequest } from "@/lib/auth";
import { isLumaConfigured, getCalendarSlugs } from "@/lib/ingestion/sources/luma";

/**
 * GET /api/admin/sources
 *
 * Static registry of every source adapter + its live health, derived from
 * the ingestionRuns collection (never fabricated). Credentials themselves
 * are NEVER returned — only a boolean "configured" flag.
 */

interface SourceMeta {
  key: string; // matches IngestionRun.source (adapter's `name` field)
  label: string;
  configured: boolean;
  configNote?: string;
}

function getSourceRegistry(): SourceMeta[] {
  return [
    {
      key: "JSearch (LinkedIn/Indeed/Glassdoor)",
      label: "JSearch",
      configured: Boolean(process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY),
      configNote: "Requires RAPIDAPI_KEY",
    },
    {
      key: "Luma Events",
      label: "Luma",
      configured: isLumaConfigured(),
      configNote: "Requires LUMA_CALENDARS",
    },
    {
      key: "Devpost",
      label: "Devpost",
      configured: true, // public scraping, no credential required
    },
    {
      key: "Devfolio",
      label: "Devfolio",
      configured: true,
    },
    {
      key: "Internshala",
      label: "Internshala",
      configured: true,
    },
    {
      key: "GitHub",
      label: "GitHub",
      configured: Boolean(process.env.GITHUB_TOKEN) || true, // works unauthenticated at lower rate limits
      configNote: process.env.GITHUB_TOKEN ? undefined : "Unauthenticated (low rate limit) — set GITHUB_TOKEN to raise it",
    },
    {
      key: "RSS",
      label: "RSS",
      configured: true,
    },
    // Not currently implemented as adapters — surfaced honestly as not configured
    // rather than hidden, so the admin sees the full intended source list from
    // the product spec (Naukri, LinkedIn as direct sources beyond JSearch).
    {
      key: "Naukri (direct)",
      label: "Naukri",
      configured: false,
      configNote: "Not implemented as a direct source — reachable today only via JSearch aggregation",
    },
    {
      key: "LinkedIn (direct)",
      label: "LinkedIn",
      configured: false,
      configNote: "Not implemented as a direct source — reachable today only via JSearch aggregation",
    },
  ];
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const runsCollection = await getIngestionRunsCollection();
    const registry = getSourceRegistry();

    const sources = await Promise.all(
      registry.map(async (meta) => {
        const runs = await runsCollection
          .find({ source: meta.key })
          .sort({ startedAt: -1 })
          .limit(50)
          .toArray();

        const lastRun = runs[0] || null;
        const lastSuccess = runs.find((r) => (r.errors || []).length === 0 && (r.fetched || 0) >= 0 && !r.failed) || null;
        const lastFailure = runs.find((r) => (r.errors || []).length > 0 || (r.failed || 0) > 0) || null;

        const totals = runs.reduce(
          (acc, r) => ({
            fetched: acc.fetched + (r.fetched || 0),
            published: acc.published + (r.inserted || 0),
            duplicates: acc.duplicates + (r.skipped || 0),
            rejected: acc.rejected + (r.failed || 0),
          }),
          { fetched: 0, published: 0, duplicates: 0, rejected: 0 }
        );

        return {
          key: meta.key,
          label: meta.label,
          configured: meta.configured,
          configNote: meta.configNote || null,
          enabled: meta.configured, // sources without required config cannot run
          lastCheckedAt: lastRun?.startedAt || null,
          lastSuccessAt: lastSuccess?.startedAt || null,
          lastFailureAt: lastFailure?.startedAt || null,
          lastError: lastFailure?.errors?.[0] || null,
          runsRecorded: runs.length,
          candidatesFetched: totals.fetched,
          published: totals.published,
          duplicates: totals.duplicates,
          rejected: totals.rejected,
          // Luma-specific: show configured calendar slugs (not credentials)
          ...(meta.label === "Luma" ? { calendars: getCalendarSlugs() } : {}),
        };
      })
    );

    return NextResponse.json({ sources });
  } catch (error) {
    console.error("[Admin] Failed to load source health:", error);
    return NextResponse.json({ error: "Failed to load source health." }, { status: 500 });
  }
}
