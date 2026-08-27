/**
 * OPPY Ingestion Scheduler
 *
 * Defines source-specific refresh intervals and manages the scheduling
 * of ingestion runs. All timing is configurable via environment variables.
 *
 * Architecture:
 *   Source websites → Scheduled ingestion → MongoDB → OPPY results
 *
 * NEVER scrape sources synchronously during user requests.
 */

// ── Source Refresh Intervals (milliseconds) ──────────────────────────────────
// Overridable via INGEST_INTERVAL_<SOURCE_KEY> environment variables.

const DEFAULT_INTERVALS: Record<string, number> = {
  // Fast-changing: hourly
  "Hacker News Who's Hiring":       60 * 60 * 1000,    // 1 hour

  // Jobs: every 2-3 hours
  "JSearch (LinkedIn/Indeed/Glassdoor/Naukri)": 3 * 60 * 60 * 1000,
  "LinkedIn Jobs":                  3 * 60 * 60 * 1000,
  "Indeed Jobs":                    3 * 60 * 60 * 1000,
  "Glassdoor Jobs":                 3 * 60 * 60 * 1000,
  "Naukri":                         3 * 60 * 60 * 1000,
  "RemoteOK":                       3 * 60 * 60 * 1000,
  "Wellfound (AngelList)":          3 * 60 * 60 * 1000,

  // Internships: every 3-4 hours
  "Internshala":                    4 * 60 * 60 * 1000,

  // Events & Hackathons: every 6 hours
  "Eventbrite Events":              6 * 60 * 60 * 1000,
  "Devpost":                        6 * 60 * 60 * 1000,
  "Devfolio":                       6 * 60 * 60 * 1000,
  "Luma Events":                    6 * 60 * 60 * 1000,
  "Unstop (D2C)":                   6 * 60 * 60 * 1000,

  // Programs & Fellowships: every 12 hours
  "GitHub":                         12 * 60 * 60 * 1000,
  "YC Work at a Startup":           12 * 60 * 60 * 1000,
  "RSS Feeds":                      6 * 60 * 60 * 1000,
};

// Friendly labels for display
const INTERVAL_LABELS: Record<string, string> = {
  "Hacker News Who's Hiring":       "hourly",
  "JSearch (LinkedIn/Indeed/Glassdoor/Naukri)": "every 3 hours",
  "LinkedIn Jobs":                  "every 3 hours",
  "Indeed Jobs":                    "every 3 hours",
  "Glassdoor Jobs":                 "every 3 hours",
  "Naukri":                         "every 3 hours",
  "RemoteOK":                       "every 3 hours",
  "Wellfound (AngelList)":          "every 3 hours",
  "Internshala":                    "every 4 hours",
  "Eventbrite Events":              "every 6 hours",
  "Devpost":                        "every 6 hours",
  "Devfolio":                       "every 6 hours",
  "Luma Events":                    "every 6 hours",
  "Unstop (D2C)":                   "every 6 hours",
  "GitHub":                         "every 12 hours",
  "YC Work at a Startup":           "every 12 hours",
  "RSS Feeds":                      "every 6 hours",
};

/**
 * Get the refresh interval for a specific source.
 * Checks environment variables first, then falls back to defaults.
 */
export function getSourceInterval(sourceName: string): number {
  // Check environment variable override: INGEST_INTERVAL_HACKER_NEWS_WHOS_HIRING=3600000
  const envKey = `INGEST_INTERVAL_${sourceName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const envValue = process.env[envKey];
  if (envValue) {
    const ms = parseInt(envValue, 10);
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return DEFAULT_INTERVALS[sourceName] || 6 * 60 * 60 * 1000; // default: 6 hours
}

/**
 * Get a human-readable label for the refresh interval.
 */
export function getSourceIntervalLabel(sourceName: string): string {
  return INTERVAL_LABELS[sourceName] || "every 6 hours";
}

/**
 * Check if a source is overdue for refresh.
 */
export function isSourceOverdue(sourceName: string, lastRunIso: string | null): boolean {
  if (!lastRunIso) return true; // Never run = overdue
  const lastRun = new Date(lastRunIso).getTime();
  const interval = getSourceInterval(sourceName);
  return Date.now() - lastRun > interval;
}

/**
 * Calculate when a source should next be refreshed.
 */
export function getNextRefreshAt(sourceName: string, lastRunIso: string | null): string | null {
  if (!lastRunIso) return null; // Should run now
  const lastRun = new Date(lastRunIso).getTime();
  const interval = getSourceInterval(sourceName);
  return new Date(lastRun + interval).toISOString();
}

/**
 * Get all registered sources with their scheduling metadata.
 */
export function getSourceSchedule(): Array<{
  name: string;
  intervalMs: number;
  intervalLabel: string;
}> {
  return Object.entries(DEFAULT_INTERVALS).map(([name, intervalMs]) => ({
    name,
    intervalMs,
    intervalLabel: INTERVAL_LABELS[name] || "every 6 hours",
  }));
}
