import { getOpportunitiesCollection } from "@/lib/mongodb";

// ── Helpers ────────────────────────────────────────────────────────────────

function passed(value: unknown, now: Date): boolean {
  return value instanceof Date && value < now;
}

function daysUntil(value: Date, now: Date): number {
  return Math.ceil((value.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
  const cursor = collection.find({
    lifecycleStatus: { $ne: "archived" },
    $or: [
      { lifecycleStatus: "active" },
      { lifecycleStatus: { $exists: false }, isActive: true },
    ],
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

    if (deadlinePassed || applicationPassed || registrationPassed || eventEnded) {
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

  // ── Detect upcoming deadlines ──────────────────────────────────────
  const upcoming = await detectUpcomingDeadlines(3);

  const durationMs = Date.now() - start;

  // ── Structured logging ─────────────────────────────────────────────
  if (closed > 0) {
    console.log(
      `[Lifecycle] Closed ${closed} expired opportunit${closed === 1 ? "y" : "ies"} (${durationMs}ms)`
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
