import { getOpportunitiesCollection, getIngestionRunsCollection } from "@/lib/mongodb";
import type { Filter, Document } from "mongodb";
import { HN_MAX_AGE_DAYS } from "@/lib/ingestion/sources/hackernews";

// ── Missing-source sweep configuration ───────────────────────────────────
// An opportunity whose listing disappeared from its source (it stopped
// appearing in fetch results, so lastSeenAt went stale) is closed after a
// PER-SOURCE grace period. Different sources crawl on very different
// cadences, so one blanket grace period is wrong: a source crawled every 4
// hours can be closed after 14 days of absence, but a site-scoped job board
// crawled monthly needs a much longer grace before absence means "gone".

// Optional uniform override (days) applied to every source policy. When unset,
// each source uses its own grace below.
const GRACE_OVERRIDE_DAYS = Number(
  process.env.LIFECYCLE_MISSING_GRACE_DAYS || 0
);

// A source is only swept when its MOST RECENT successful run (fetched > 0)
// happened within this window. If the source itself is down/broken for longer
// than this, we do NOT touch its inventory — mass-closing on an outage is far
// worse than leaving stale-but-likely-still-live listings visible.
const SOURCE_RUN_WINDOW_DAYS = Number(process.env.LIFECYCLE_SOURCE_RUN_WINDOW_DAYS || 60);

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SourceSweepPolicy {
  /** Days a listing must be unseen before it may be closed. */
  graceDays: number;
  /**
   * When true, additionally require a successful crawl that completed AFTER
   * the record's lastSeenAt (i.e. the crawler re-ran and still did not see the
   * listing) before closing. Only meaningful for crawlers that reflect the
   * full inventory each run.
   */
  confirmAbsenceOnRecentCrawl: boolean;
  /**
   * When set, only records whose sourceId starts with this prefix are eligible
   * for the absence sweep. Guards labels that BOTH a direct comprehensive
   * crawler and the rotation-limited JSearch family can emit (e.g. "Naukri":
   * the direct adapter writes `naukri-<slug>` ids, JSearch writes raw provider
   * ids). Without it, a JSearch-derived record could be closed using the
   * direct crawler's run as "absence evidence", which is invalid because the
   * JSearch crawl's inventory is partial by design.
   */
  sourceIdPrefix?: string;
}

// Opportunity `source` labels eligible for the missing-source sweep and their
// per-source grace policy. Only COMPREHENSIVE crawlers — adapters whose
// successful run reflects the full inventory — are listed here.
//
// Deliberately NOT listed (never swept by absence):
//   - JSearch family (JSearch/LinkedIn/Indeed/Glassdoor/Wellfound/ZipRecruiter/…):
//     the provider plan rotates countries/queries and paginates page 1, so a
//     listing missing from a crawl is NOT evidence it was removed.
//   - "Hacker News": has its own staleness rule (HN_MAX_AGE_DAYS).
//   - GitHub Open Source Programs / Well-Known Student Programs: their adapters
//     implement fetch(), but they are NOT registered in the active pipeline
//     registry (ALL_SOURCES), and their curated program lists (GSoC,
//     Outreachy, MLH Fellowship, …) are fixed annual cycles — absence from a
//     crawl is not removal evidence, so they are intentionally never swept.
export const SOURCE_SWEEP_POLICIES: Record<string, SourceSweepPolicy> = {
  Internshala: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // 4h cadence
  RemoteOK: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // 3h cadence
  // Naukri is also emitted by the JSearch platformMap (job_publisher contains
  // "naukri"), so only records with the direct adapter's `naukri-` sourceId
  // prefix may be swept — JSearch-derived "Naukri" records are never closed
  // using the direct crawler's run as evidence.
  Naukri: { graceDays: 14, confirmAbsenceOnRecentCrawl: true, sourceIdPrefix: "naukri-" }, // direct scrape, 3h
  Eventbrite: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // 6h
  Devpost: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // 6h
  Devfolio: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // 6h
  MLH: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // via Devfolio adapter
  Unstop: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // 6h
  Luma: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // 6h
  RSS: { graceDays: 14, confirmAbsenceOnRecentCrawl: true }, // feeds rotate daily
  YCombinator: { graceDays: 21, confirmAbsenceOnRecentCrawl: true }, // 12h
};

// Opportunity `source` label → ingestion-run `source` names (adapter display
// names) that can produce records carrying that label. Run telemetry is stored
// under the ADAPTER name (e.g. "Eventbrite Events"), while opportunities store
// the PLATFORM label (e.g. "Eventbrite") — the sweep must translate between
// the two or it silently never fires for most sources.
export const SOURCE_LABEL_RUN_NAMES: Record<string, string[]> = {
  Internshala: ["Internshala"],
  RemoteOK: ["RemoteOK"],
  Naukri: ["Naukri"],
  Eventbrite: ["Eventbrite Events"],
  Devpost: ["Devpost Hackathons"],
  Devfolio: ["Devfolio Hackathons"],
  MLH: ["Devfolio Hackathons"],
  Unstop: ["Unstop (D2C)"],
  Luma: ["Luma Events"],
  RSS: ["RSS Feeds"],
  YCombinator: ["YC Work at a Startup"],
};

/** Sweep policy for an opportunity `source` label, or null when the label is not swept. */
export function getSourceSweepPolicy(sourceLabel: string): SourceSweepPolicy | null {
  const policy = SOURCE_SWEEP_POLICIES[sourceLabel];
  if (!policy) return null;
  if (GRACE_OVERRIDE_DAYS > 0) {
    return { graceDays: GRACE_OVERRIDE_DAYS, confirmAbsenceOnRecentCrawl: policy.confirmAbsenceOnRecentCrawl };
  }
  return policy;
}

/** Ingestion-run source names that can produce records with the given `source` label. */
export function getRunSourceNamesForLabel(sourceLabel: string): string[] {
  return SOURCE_LABEL_RUN_NAMES[sourceLabel] || [];
}

/**
 * Build the record filter for the absence sweep of one source label.
 *
 * Base conditions: record carries the label, is active (not archived), and was
 * last seen before the effective cutoff. When the source's policy defines a
 * `sourceIdPrefix`, only records whose sourceId matches that scheme are swept
 * — this is the guard that keeps JSearch-family records (e.g. a JSearch
 * "Naukri" label) from ever being absence-swept using a direct crawler's run
 * as evidence.
 */
export function sweepRecordFilter(
  sourceLabel: string,
  effectiveCutoff: Date
): Filter<Document> {
  const policy = getSourceSweepPolicy(sourceLabel);
  const filter: Filter<Document> = {
    source: sourceLabel,
    isActive: true,
    lifecycleStatus: { $ne: "archived" },
    lastSeenAt: { $type: "date", $lt: effectiveCutoff },
  };
  if (policy?.sourceIdPrefix) {
    filter.sourceId = { $regex: new RegExp(`^${policy.sourceIdPrefix}`) };
  }
  return filter;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function passed(value: unknown, now: Date): boolean {
  return value instanceof Date && value < now;
}

function daysUntil(value: Date, now: Date): number {
  return Math.ceil((value.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Whether a source is eligible for the missing-source sweep.
 *
 * Requires evidence the source was crawled successfully RECENTLY (its latest
 * run with fetched > 0 happened after `runWindowCutoff`). When a source is
 * down or its adapter is broken, its latest successful run goes stale — and we
 * must NOT mass-close that source's inventory on top of an outage.
 */
export function isSourceSweepEligible(
  lastRun: { completedAt?: string | Date | null; fetched?: number } | null,
  runWindowCutoff: Date
): boolean {
  const lastRunAt = toDate(lastRun?.completedAt ?? null);
  if (!lastRunAt) return false;
  return lastRunAt >= runWindowCutoff && Number(lastRun?.fetched) > 0;
}

/**
 * Pure decision: is this record a candidate for absence-driven closure?
 *
 * `sweepCutoff` is the latest timestamp the record may have been seen for it to
 * be considered missing (already accounts for the source's grace period and —
 * when the policy requires crawl confirmation — the latest successful crawl).
 */
export function isMissingSince(
  lastSeenAt: Date | string | null | undefined,
  sweepCutoff: Date
): boolean {
  const seen = toDate(lastSeenAt);
  if (!seen) return false; // no lastSeenAt → never confirm absence (leave untouched)
  return seen < sweepCutoff;
}

/**
 * Pure classifier for legacy records created before lifecycle fields existed.
 *
 * - A record still being seen by a source crawl (lastSeenAt within `graceDays`)
 *   is plainly live → "activate".
 * - A record with no lastSeenAt, or one unseen beyond the grace window, cannot
 *   be confirmed live → "close_unseen" (kept for history, never deleted). If a
 *   source later sees the listing again, ingestion reactivates it.
 */
export type LegacyOrphanAction = "activate" | "close_unseen";
export function classifyLegacyOrphan(opts: {
  lastSeenAt?: Date | string | null;
  now: Date;
  graceDays: number;
}): LegacyOrphanAction {
  const seen = toDate(opts.lastSeenAt);
  if (!seen) return "close_unseen";
  return opts.now.getTime() - seen.getTime() <= opts.graceDays * DAY_MS
    ? "activate"
    : "close_unseen";
}

// ── Upcoming Deadline Detection ─────────────────────────────────────────────

export interface UpcomingDeadline {
  opportunityId: string;
  title: string;
  organization: string;
  category: string;
  deadlineType: "deadline" | "applicationDeadline" | "registrationDeadline";
  deadlineDate: Date;
  daysRemaining: number;
}

/**
 * Find active opportunities with deadlines approaching within `withinDays`.
 * Returns opportunities sorted by deadline (soonest first).
 * Does NOT modify any records — read-only query.
 */
export async function detectUpcomingDeadlines(
  withinDays: number = 3
): Promise<UpcomingDeadline[]> {
  const collection = await getOpportunitiesCollection();
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const upcoming: UpcomingDeadline[] = [];

  // Find active opportunities with any deadline in the near future
  const cursor = collection.find({
    lifecycleStatus: "active",
    $or: [
      {
        deadline: { $gte: now, $lte: cutoff },
        deadlineKind: { $in: ["verified", "source_provided"] },
      },
      {
        applicationDeadline: { $gte: now, $lte: cutoff },
      },
      {
        registrationDeadline: { $gte: now, $lte: cutoff },
      },
    ],
  });

  for await (const opp of cursor) {
    const oppId = opp._id.toString();

    // Check each deadline type
    const deadlines: Array<{
      type: "deadline" | "applicationDeadline" | "registrationDeadline";
      date: Date | null;
    }> = [
      { type: "deadline", date: opp.deadline instanceof Date ? opp.deadline : null },
      { type: "applicationDeadline", date: opp.applicationDeadline instanceof Date ? opp.applicationDeadline : null },
      { type: "registrationDeadline", date: opp.registrationDeadline instanceof Date ? opp.registrationDeadline : null },
    ];

    for (const dl of deadlines) {
      if (dl.date && dl.date >= now && dl.date <= cutoff) {
        upcoming.push({
          opportunityId: oppId,
          title: opp.title,
          organization: opp.organization,
          category: opp.category,
          deadlineType: dl.type,
          deadlineDate: dl.date,
          daysRemaining: daysUntil(dl.date, now),
        });
      }
    }
  }

  // Sort by days remaining (soonest first)
  upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return upcoming;
}

// ── Lifecycle Refresh ───────────────────────────────────────────────────────

export interface LifecycleResult {
  closed: number;
  upcoming: UpcomingDeadline[];
  checkedAt: Date;
  durationMs: number;
}

/**
 * Refresh opportunity lifecycle: close expired records and detect upcoming deadlines.
 *
 * This function is idempotent — safe to run repeatedly without side effects
 * on already-closed or archived records.
 *
 * Called by:
 *   - /api/cron/lifecycle (dedicated lifecycle endpoint)
 *   - /api/cron/ingest (at the start of the ingestion pipeline)
 */
export async function refreshOpportunityLifecycle(): Promise<LifecycleResult> {
  const start = Date.now();
  const collection = await getOpportunitiesCollection();
  const now = new Date();
  let closed = 0;

  // ── Close expired opportunities ────────────────────────────────────
  // Only touches active records with verified/passed actionable dates.
  // Archived records are never touched.
  // Catch ALL active opportunities — including records where lifecycleStatus
  // is inconsistent with isActive (e.g., lifecycleStatus='closed' but isActive=true).
  const cursor = collection.find({
    isActive: true,
    lifecycleStatus: { $ne: "archived" },
  });

  for await (const opportunity of cursor) {
    const deadlinePassed =
      ["verified", "source_provided"].includes(String(opportunity.deadlineKind)) &&
      passed(opportunity.deadline, now);
    const applicationPassed = passed(opportunity.applicationDeadline, now);
    const registrationPassed = passed(opportunity.registrationDeadline, now);
    const noActionDate =
      !opportunity.deadline &&
      !opportunity.applicationDeadline &&
      !opportunity.registrationDeadline;
    const eventEnded =
      noActionDate &&
      (passed(opportunity.eventEndDate, now) ||
        (!opportunity.eventEndDate && passed(opportunity.eventDate, now)));

    // ── HN-specific: close stale "Who is hiring?" posts ──────────
    // HN monthly threads have no deadlines, so the generic logic never
    // closes them. Close any HN-sourced opportunity older than HN_MAX_AGE_DAYS.
    const hnStale =
      opportunity.source === "Hacker News" &&
      opportunity.firstSeenAt instanceof Date &&
      now.getTime() - opportunity.firstSeenAt.getTime() > HN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    if (deadlinePassed || applicationPassed || registrationPassed || eventEnded || hnStale) {
      await collection.updateOne(
        {
          _id: opportunity._id,
          lifecycleStatus: { $ne: "archived" },
        },
        {
          $set: {
            lifecycleStatus: "closed",
            isActive: false,
            lifecycleUpdatedAt: now,
            updatedAt: now,
          },
        }
      );
      closed++;
    }
  }

  // ── Reconcile legacy orphans ─────────────────────────────────────────
  // Records created before lifecycle fields existed have neither
  // lifecycleStatus nor isActive, so they never appear in discovery even when
  // the adapter is actively refreshing them (their listing is live). Restore
  // them to a consistent state: activate the ones still being seen, close the
  // ones that cannot be confirmed live. Never deletes anything.
  const reconciled = await reconcileLegacyOrphans();
  if (reconciled.activated + reconciled.closedUnseen > 0) {
    console.log(
      `[Lifecycle] Reconciled legacy orphans: ${reconciled.activated} activated, ` +
      `${reconciled.closedUnseen} closed (unseen)`
    );
  }

  // ── Close opportunities removed from their source ───────────────────
  // When a source deletes a listing, it stops appearing in fetch results and
  // its record's lastSeenAt goes stale. Close those records after a PER-SOURCE
  // grace period — but ONLY when we have evidence the source was crawled
  // successfully RECENTLY (latest run with fetched > 0 within
  // SOURCE_RUN_WINDOW_DAYS), so a broken adapter, source outage, or a single
  // failed/partial run never mass-closes live inventory.
  //
  // Label ↔ run-name translation matters here: telemetry stores the ADAPTER
  // name ("Eventbrite Events"), opportunities store the PLATFORM label
  // ("Eventbrite"). Only sources with an explicit policy + run mapping are
  // swept at all (see SOURCE_SWEEP_POLICIES / SOURCE_LABEL_RUN_NAMES).
  const runWindowCutoff = new Date(now.getTime() - SOURCE_RUN_WINDOW_DAYS * DAY_MS);
  const runsCollection = await getIngestionRunsCollection();
  const activeSources = await collection.distinct("source", {
    isActive: true,
    lifecycleStatus: { $ne: "archived" },
  });
  let closedMissing = 0;
  for (const src of activeSources) {
    const policy = getSourceSweepPolicy(String(src));
    const runNames = getRunSourceNamesForLabel(String(src));
    if (!policy || runNames.length === 0) continue; // not sweep-eligible (see design notes above)

    const lastRun = await runsCollection.findOne(
      { source: { $in: runNames }, status: { $in: ["success", null] } },
      { sort: { completedAt: -1 } }
    );
    if (!isSourceSweepEligible(
      lastRun as { completedAt?: string | Date | null; fetched?: number } | null,
      runWindowCutoff
    )) continue;

    // Records must be unseen for the source's grace period…
    const graceCutoff = new Date(now.getTime() - policy.graceDays * DAY_MS);
    // …and (for comprehensive crawlers) must ALSO predate the most recent
    // successful crawl — i.e. the crawler re-ran since we last saw this record
    // and still did not include it. That is the "sufficient evidence the
    // listing genuinely disappeared" bar. Absence alone (grace) would wrongly
    // close listings on slow/partial/rotating sources, so rotation-limited
    // sources (JSearch family) are excluded from this sweep entirely.
    const lastRunAt = toDate(lastRun?.completedAt ?? null)!;
    const effectiveCutoff = policy.confirmAbsenceOnRecentCrawl
      ? new Date(Math.min(graceCutoff.getTime(), lastRunAt.getTime()))
      : graceCutoff;

    const res = await collection.updateMany(
      sweepRecordFilter(src, effectiveCutoff),
      {
        $set: {
          lifecycleStatus: "closed",
          isActive: false,
          lifecycleUpdatedAt: now,
          updatedAt: now,
          closedReason: "removed_from_source",
        },
      }
    );
    if (res.modifiedCount > 0) {
      console.log(
        `[Lifecycle] Closed ${res.modifiedCount} ${src} listing(s) missing from source ` +
        `(unseen since before ${effectiveCutoff.toISOString().slice(0, 10)})`
      );
    }
    closedMissing += res.modifiedCount;
  }
  closed += closedMissing;

  // ── Detect upcoming deadlines ──────────────────────────────────────
  const upcoming = await detectUpcomingDeadlines(3);

  const durationMs = Date.now() - start;

  // ── Structured logging ─────────────────────────────────────────────
  if (closed > 0) {
    console.log(
      `[Lifecycle] Closed ${closed} opportunit${closed === 1 ? "y" : "ies"} ` +
      `(${closedMissing} removed from source, ${durationMs}ms)`
    );
  }
  if (upcoming.length > 0) {
    const urgent = upcoming.filter((u) => u.daysRemaining <= 1);
    const soon = upcoming.filter((u) => u.daysRemaining > 1);
    if (urgent.length > 0) {
      console.log(
        `[Lifecycle] ⚠️  ${urgent.length} opportunit${urgent.length === 1 ? "y" : "ies"} closing today/tomorrow`
      );
    }
    if (soon.length > 0) {
      console.log(
        `[Lifecycle] 📅 ${soon.length} opportunit${soon.length === 1 ? "y" : "ies"} closing within 3 days`
      );
    }
  }

  return { closed, upcoming, checkedAt: now, durationMs };
}

// ── Legacy orphan reconciliation ────────────────────────────────────────────

export interface OrphanReconcileResult {
  activated: number;
  closedUnseen: number;
}

/**
 * Activate/close records created before lifecycle fields existed (no
 * lifecycleStatus / isActive). Idempotent — after the first pass there is
 * nothing left to reconcile, so subsequent runs are no-ops.
 *
 * Rule (per record): if its lastSeenAt is fresh enough that a live crawl is
 * still touching it, it is plainly live → activate. Otherwise it cannot be
 * confirmed live → close it (never delete). If a closed record later reappears
 * in a source crawl, the ingestion update path reactivates it automatically.
 *
 * The grace window defaults to 45 days (2× the longest policy grace) and can
 * be tuned with LIFECYCLE_MISSING_GRACE_DAYS.
 */
export async function reconcileLegacyOrphans(): Promise<OrphanReconcileResult> {
  const collection = await getOpportunitiesCollection();
  const now = new Date();
  const graceDays = GRACE_OVERRIDE_DAYS > 0 ? GRACE_OVERRIDE_DAYS : 45;

  const orphans = collection.find({
    lifecycleStatus: { $exists: false },
  });

  let activated = 0;
  let closedUnseen = 0;
  for await (const orphan of orphans) {
    const action = classifyLegacyOrphan({
      lastSeenAt: orphan.lastSeenAt as Date | string | null | undefined,
      now,
      graceDays,
    });

    if (action === "activate") {
      const res = await collection.updateOne(
        { _id: orphan._id, lifecycleStatus: { $exists: false } },
        {
          $set: {
            lifecycleStatus: "active",
            isActive: true,
            lifecycleUpdatedAt: now,
            updatedAt: now,
          },
        }
      );
      if (res.modifiedCount > 0) activated++;
    } else {
      const res = await collection.updateOne(
        { _id: orphan._id, lifecycleStatus: { $exists: false } },
        {
          $set: {
            lifecycleStatus: "closed",
            isActive: false,
            lifecycleUpdatedAt: now,
            updatedAt: now,
            closedReason: "legacy_orphan_unseen",
          },
        }
      );
      if (res.modifiedCount > 0) closedUnseen++;
    }
  }

  return { activated, closedUnseen };
}
