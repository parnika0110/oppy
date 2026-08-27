import { NextRequest, NextResponse } from "next/server";
import { getIngestionRunsCollection } from "@/lib/mongodb";
import { isAdminRequest } from "@/lib/auth";
import { isLumaConfigured, getCalendarSlugs } from "@/lib/ingestion/sources/luma";
import { getSourceInterval, getSourceIntervalLabel, isSourceOverdue, getNextRefreshAt } from "@/lib/ingestion/scheduler";

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
  const hasRapidApi = Boolean(process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY);
  return [
    // ── Hackathons & Events (no auth needed) ─────────────────────────────
    {
      key: "Devpost",
      label: "Devpost",
      configured: true,
    },
    {
      key: "Devfolio",
      label: "Devfolio + MLH",
      configured: true,
    },
    {
      key: "Luma Events",
      label: "Luma",
      configured: isLumaConfigured(),
      configNote: "Requires LUMA_CALENDARS",
    },
    {
      key: "Eventbrite Events",
      label: "Eventbrite",
      configured: true,
    },
    {
      key: "Unstop (D2C)",
      label: "Unstop",
      configured: true,
    },
    // ── Jobs & Internships ────────────────────────────────────────────────
    {
      key: "JSearch (LinkedIn/Indeed/Glassdoor/Naukri)",
      label: "JSearch (Aggregated)",
      configured: hasRapidApi,
      configNote: "Requires RAPIDAPI_KEY — covers LinkedIn, Indeed, Glassdoor, Naukri, ZipRecruiter",
    },
    {
      key: "LinkedIn Jobs",
      label: "LinkedIn",
      configured: hasRapidApi,
      configNote: "Requires RAPIDAPI_KEY (via JSearch)",
    },
    {
      key: "Indeed Jobs",
      label: "Indeed",
      configured: hasRapidApi,
      configNote: "Requires RAPIDAPI_KEY (via JSearch)",
    },
    {
      key: "Glassdoor Jobs",
      label: "Glassdoor",
      configured: hasRapidApi,
      configNote: "Requires RAPIDAPI_KEY (via JSearch)",
    },
    {
      key: "Naukri",
      label: "Naukri",
      configured: true,
    },
    {
      key: "Internshala",
      label: "Internshala",
      configured: true,
    },
    {
      key: "RemoteOK",
      label: "RemoteOK",
      configured: true,
    },
    // ── Startups & Programs ──────────────────────────────────────────────
    {
      key: "YC Work at a Startup",
      label: "YCombinator",
      configured: true,
    },
    {
      key: "Hacker News Who's Hiring",
      label: "Hacker News",
      configured: true,
    },
    {
      key: "Wellfound (AngelList)",
      label: "Wellfound",
      configured: hasRapidApi,
      configNote: "Requires RAPIDAPI_KEY (via JSearch)",
    },
    {
      key: "GitHub",
      label: "GitHub",
      configured: true,
    },
    // ── RSS & Aggregation ────────────────────────────────────────────────
    {
      key: "RSS Feeds",
      label: "RSS Feeds",
      configured: true,
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

        // Scheduling metadata
        const intervalMs = getSourceInterval(meta.key);
        const intervalLabel = getSourceIntervalLabel(meta.key);
        const lastRunIso = lastRun?.startedAt || null;
        const isOverdue = isSourceOverdue(meta.key, lastRunIso);
        const nextRefresh = getNextRefreshAt(meta.key, lastRunIso);

        return {
          key: meta.key,
          label: meta.label,
          configured: meta.configured,
          configNote: meta.configNote || null,
          enabled: meta.configured,
          lastCheckedAt: lastRunIso,
          lastSuccessAt: lastSuccess?.startedAt || null,
          lastFailureAt: lastFailure?.startedAt || null,
          lastError: lastFailure?.errors?.[0] || null,
          runsRecorded: runs.length,
          candidatesFetched: totals.fetched,
          published: totals.published,
          duplicates: totals.duplicates,
          rejected: totals.rejected,
          // Scheduling
          refreshIntervalMs: intervalMs,
          refreshIntervalLabel: intervalLabel,
          isOverdue,
          nextRefreshAt: nextRefresh,
          // Luma-specific
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
