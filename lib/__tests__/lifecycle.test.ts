import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSourceSweepEligible,
  getSourceSweepPolicy,
  getRunSourceNamesForLabel,
  classifyLegacyOrphan,
  isMissingSince,
  sweepRecordFilter,
  SOURCE_SWEEP_POLICIES,
  SOURCE_LABEL_RUN_NAMES,
  reconcileLegacyOrphans,
} from "@/lib/lifecycle";

// ── In-memory collection double for reconcileLegacyOrphans ───────────────
// Only the parts reconcile touches: find({ lifecycleStatus: {$exists:false} })
// iterated with for-await, and guarded updateOne per document.
const orphanDb = vi.hoisted(() => {
  const state: {
    docs: Array<Record<string, unknown> & { _id: string }>;
    collection: unknown;
  } = {
    docs: [],
    collection: null,
  };
  const makeCollection = (docs: Array<Record<string, unknown> & { _id: string }>) => ({
    find() {
      const matches = docs.filter((d) => !("lifecycleStatus" in d));
      return {
        [Symbol.asyncIterator]: async function* () {
          for (const m of matches) yield m;
        },
      };
    },
    async updateOne(filter: any, update: any) {
      const doc = docs.find((d) => String(d._id) === String(filter._id));
      if (!doc || "lifecycleStatus" in doc) return { modifiedCount: 0 };
      Object.assign(doc, update.$set);
      return { modifiedCount: 1 };
    },
  });
  return {
    setDocs(docs: Array<Record<string, unknown> & { _id: string }>) {
      state.docs = docs;
      state.collection = makeCollection(docs);
    },
    get collection() {
      return state.collection;
    },
    get docs() {
      return state.docs;
    },
  };
});

vi.mock("@/lib/mongodb", () => ({
  getOpportunitiesCollection: async () => orphanDb.collection,
  getIngestionRunsCollection: async () => ({
    findOne: async () => null,
  }),
}));

/**
 * Lifecycle classification tests.
 *
 * Rules:
 * - Active + verified/source_provided deadline passed → closed
 * - Active + eventEndDate passed (no separate action date) → closed
 * - Active + no deadline known → stays active (do not infer)
 * - Rolling → stays active (source says open)
 * - Archived → never touched
 * - Already closed → never touched
 */

// Replicate the lifecycle logic from lib/lifecycle.ts for testing
function shouldClose(opportunity: {
  lifecycleStatus?: string;
  deadlineKind?: string;
  deadline?: Date | null;
  applicationDeadline?: Date | null;
  registrationDeadline?: Date | null;
  eventEndDate?: Date | null;
  eventDate?: Date | null;
}): boolean {
  if (opportunity.lifecycleStatus === "archived") return false;
  if (opportunity.lifecycleStatus !== "active") return false;

  const now = new Date();

  // Verified/source_provided deadline passed
  if (
    ["verified", "source_provided"].includes(opportunity.deadlineKind || "") &&
    opportunity.deadline &&
    opportunity.deadline < now
  ) {
    return true;
  }

  // Application deadline passed
  if (opportunity.applicationDeadline && opportunity.applicationDeadline < now) {
    return true;
  }

  // Registration deadline passed
  if (opportunity.registrationDeadline && opportunity.registrationDeadline < now) {
    return true;
  }

  // Event ended with no separate action date
  const noActionDate =
    !opportunity.deadline &&
    !opportunity.applicationDeadline &&
    !opportunity.registrationDeadline;

  if (noActionDate) {
    if (opportunity.eventEndDate && opportunity.eventEndDate < now) return true;
    if (!opportunity.eventEndDate && opportunity.eventDate && opportunity.eventDate < now)
      return true;
  }

  return false;
}

// ── Upcoming deadline detection logic ──────────────────────────────────────

function getUpcomingDeadlines(opportunity: {
  lifecycleStatus?: string;
  deadlineKind?: string;
  deadline?: Date | null;
  applicationDeadline?: Date | null;
  registrationDeadline?: Date | null;
}, withinDays: number = 3): Array<{ type: string; date: Date; daysRemaining: number }> {
  if (opportunity.lifecycleStatus !== "active") return [];

  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const upcoming: Array<{ type: string; date: Date; daysRemaining: number }> = [];

  const deadlines = [
    { type: "deadline", date: opportunity.deadline, kind: opportunity.deadlineKind },
    { type: "applicationDeadline", date: opportunity.applicationDeadline },
    { type: "registrationDeadline", date: opportunity.registrationDeadline },
  ];

  for (const dl of deadlines) {
    if (!(dl.date instanceof Date)) continue;
    if (dl.type === "deadline" && !["verified", "source_provided"].includes(dl.kind || "")) continue;
    if (dl.date >= now && dl.date <= cutoff) {
      const daysRemaining = Math.ceil((dl.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      upcoming.push({ type: dl.type, date: dl.date, daysRemaining });
    }
  }

  return upcoming;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPIRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("lifecycle classification — expiration", () => {
  it("closes active opportunity with passed verified deadline", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "verified",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(true);
  });

  it("closes active opportunity with passed source_provided deadline", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "source_provided",
        deadline: new Date("2020-06-01"),
      })
    ).toBe(true);
  });

  it("keeps active opportunity with future deadline", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "verified",
        deadline: new Date("2099-01-01"),
      })
    ).toBe(false);
  });

  it("keeps active opportunity with unavailable deadline (no inference)", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
      })
    ).toBe(false);
  });

  it("keeps active rolling opportunity", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "rolling",
        deadline: null,
      })
    ).toBe(false);
  });

  it("closes active event with passed eventEndDate and no action date", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: null,
        registrationDeadline: null,
        eventEndDate: new Date("2020-01-01"),
      })
    ).toBe(true);
  });

  it("keeps active event with future eventEndDate", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        eventEndDate: new Date("2099-01-01"),
      })
    ).toBe(false);
  });

  it("keeps active event with passed eventEndDate but future application deadline", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: new Date("2099-01-01"),
        eventEndDate: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("never closes archived records", () => {
    expect(
      shouldClose({
        lifecycleStatus: "archived",
        deadlineKind: "verified",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("never closes closed records", () => {
    expect(
      shouldClose({
        lifecycleStatus: "closed",
        deadlineKind: "verified",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("closes active opportunity with passed applicationDeadline", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: new Date("2020-01-01"),
      })
    ).toBe(true);
  });

  it("closes active event with passed eventDate and no endDate and no action date", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: null,
        registrationDeadline: null,
        eventDate: new Date("2020-01-01"),
        eventEndDate: null,
      })
    ).toBe(true);
  });

  it("does not close when eventDate exists but eventEndDate is in future", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        eventEndDate: new Date("2099-01-01"),
        eventDate: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("closes active opportunity with passed registrationDeadline", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: null,
        registrationDeadline: new Date("2020-01-01"),
      })
    ).toBe(true);
  });

  it("does not close when registrationDeadline is in future", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: null,
        registrationDeadline: new Date("2099-01-01"),
      })
    ).toBe(false);
  });

  it("does not close when deadline is today (not yet passed)", () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "verified",
        deadline: today,
      })
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UPCOMING DEADLINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("upcoming deadline detection", () => {
  it("detects deadline within 3 days", () => {
    const in2Days = new Date();
    in2Days.setDate(in2Days.getDate() + 2);
    const upcoming = getUpcomingDeadlines({
      lifecycleStatus: "active",
      deadlineKind: "verified",
      deadline: in2Days,
    });
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].type).toBe("deadline");
    expect(upcoming[0].daysRemaining).toBeLessThanOrEqual(2);
  });

  it("detects applicationDeadline within 3 days", () => {
    const in1Day = new Date();
    in1Day.setDate(in1Day.getDate() + 1);
    const upcoming = getUpcomingDeadlines({
      lifecycleStatus: "active",
      deadlineKind: "unavailable",
      applicationDeadline: in1Day,
    });
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].type).toBe("applicationDeadline");
  });

  it("does not detect deadline beyond 3 days", () => {
    const in10Days = new Date();
    in10Days.setDate(in10Days.getDate() + 10);
    const upcoming = getUpcomingDeadlines({
      lifecycleStatus: "active",
      deadlineKind: "verified",
      deadline: in10Days,
    });
    expect(upcoming).toHaveLength(0);
  });

  it("does not detect deadline for non-active opportunities", () => {
    const in2Days = new Date();
    in2Days.setDate(in2Days.getDate() + 2);
    const upcoming = getUpcomingDeadlines({
      lifecycleStatus: "closed",
      deadlineKind: "verified",
      deadline: in2Days,
    });
    expect(upcoming).toHaveLength(0);
  });

  it("does not detect unavailable deadline as upcoming", () => {
    const in2Days = new Date();
    in2Days.setDate(in2Days.getDate() + 2);
    const upcoming = getUpcomingDeadlines({
      lifecycleStatus: "active",
      deadlineKind: "unavailable",
      deadline: in2Days,
    });
    expect(upcoming).toHaveLength(0);
  });

  it("detects multiple upcoming deadlines", () => {
    const in1Day = new Date();
    in1Day.setDate(in1Day.getDate() + 1);
    const in2Days = new Date();
    in2Days.setDate(in2Days.getDate() + 2);
    const upcoming = getUpcomingDeadlines({
      lifecycleStatus: "active",
      deadlineKind: "verified",
      deadline: in1Day,
      applicationDeadline: in2Days,
    });
    expect(upcoming).toHaveLength(2);
  });

  it("ignores past deadlines in upcoming detection", () => {
    const upcoming = getUpcomingDeadlines({
      lifecycleStatus: "active",
      deadlineKind: "verified",
      deadline: new Date("2020-01-01"),
    });
    expect(upcoming).toHaveLength(0);
  });

  it("respects custom withinDays parameter", () => {
    const in5Days = new Date();
    in5Days.setDate(in5Days.getDate() + 5);
    // Within 3 days — should not detect
    expect(
      getUpcomingDeadlines(
        { lifecycleStatus: "active", deadlineKind: "verified", deadline: in5Days },
        3
      )
    ).toHaveLength(0);
    // Within 7 days — should detect
    expect(
      getUpcomingDeadlines(
        { lifecycleStatus: "active", deadlineKind: "verified", deadline: in5Days },
        7
      )
    ).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("lifecycle idempotency", () => {
  it("closing an already-closed record returns false (no-op)", () => {
    expect(
      shouldClose({
        lifecycleStatus: "closed",
        deadlineKind: "verified",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("closing an already-archived record returns false (no-op)", () => {
    expect(
      shouldClose({
        lifecycleStatus: "archived",
        deadlineKind: "verified",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("record without lifecycleStatus defaults to not closing", () => {
    // Legacy records without lifecycleStatus — the actual code checks
    // lifecycleStatus === "active" explicitly, so undefined = not active
    expect(
      shouldClose({
        deadlineKind: "verified",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("lifecycle edge cases", () => {
  it("handles multiple passed deadlines (any one triggers close)", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "verified",
        deadline: new Date("2020-01-01"),
        applicationDeadline: new Date("2020-06-01"),
        registrationDeadline: new Date("2020-03-01"),
      })
    ).toBe(true);
  });

  it("does not close when all dates are in the future", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "verified",
        deadline: new Date("2099-12-31"),
        applicationDeadline: new Date("2099-12-31"),
        registrationDeadline: new Date("2099-12-31"),
      })
    ).toBe(false);
  });

  it("handles empty string deadlineKind gracefully", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(false); // empty string deadlineKind is not verified/source_provided
  });

  it("handles undefined deadlineKind gracefully", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadline: new Date("2020-01-01"),
      })
    ).toBe(false); // undefined deadlineKind is not verified/source_provided
  });

  it("does not treat eventEndDate as action date when applicationDeadline exists", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: new Date("2099-01-01"),
        eventEndDate: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("does not treat eventDate as action date when registrationDeadline exists", () => {
    expect(
      shouldClose({
        lifecycleStatus: "active",
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: null,
        registrationDeadline: new Date("2099-01-01"),
        eventDate: new Date("2020-01-01"),
      })
    ).toBe(false);
  });
});

describe("missing-source sweep eligibility (isSourceSweepEligible)", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  const windowCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  it("is eligible when the latest run succeeded recently with fetched > 0", () => {
    expect(
      isSourceSweepEligible({ completedAt: now.toISOString(), fetched: 40 }, windowCutoff)
    ).toBe(true);
  });

  it("is NOT eligible when the latest run is older than the window", () => {
    expect(
      isSourceSweepEligible({ completedAt: new Date(now.getTime() - 61 * 24 * 60 * 60 * 1000).toISOString(), fetched: 40 }, windowCutoff)
    ).toBe(false);
  });

  it("is NOT eligible when the latest run fetched 0 items (adapter may be broken)", () => {
    expect(
      isSourceSweepEligible({ completedAt: now.toISOString(), fetched: 0 }, windowCutoff)
    ).toBe(false);
  });

  it("is NOT eligible when there is no run record at all", () => {
    expect(isSourceSweepEligible(null, windowCutoff)).toBe(false);
  });

  it("accepts Date objects as well as ISO strings", () => {
    expect(
      isSourceSweepEligible({ completedAt: new Date(now), fetched: 5 }, windowCutoff)
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PER-SOURCE SWEEP POLICY & LABEL→RUN-NAME MAPPING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("per-source missing-source sweep policy", () => {
  it("gives fast-crawled sources a short grace period", () => {
    expect(getSourceSweepPolicy("Internshala")?.graceDays).toBeLessThanOrEqual(21);
    expect(getSourceSweepPolicy("Eventbrite")?.graceDays).toBeLessThanOrEqual(21);
  });

  it("requires crawl-confirmation for comprehensive crawlers", () => {
    const policy = getSourceSweepPolicy("Internshala");
    expect(policy?.confirmAbsenceOnRecentCrawl).toBe(true);
  });

  it("never sweeps rotation/pagination-limited JSearch-family labels", () => {
    // Absence from a rotated/page-1 crawl is NOT evidence of removal.
    for (const label of ["JSearch", "LinkedIn", "Indeed", "Glassdoor", "Wellfound", "ZipRecruiter"]) {
      expect(getSourceSweepPolicy(label)).toBeNull();
    }
  });

  it("never sweeps Hacker News (it has its own staleness rule)", () => {
    expect(getSourceSweepPolicy("Hacker News")).toBeNull();
  });

  it("returns null for unknown/unmapped labels", () => {
    expect(getSourceSweepPolicy("Google")).toBeNull();
    expect(getSourceSweepPolicy("TotallyMadeUp")).toBeNull();
  });

  it("maps every swept label to at least one ingestion-run source name", () => {
    for (const label of Object.keys(SOURCE_SWEEP_POLICIES)) {
      expect(getRunSourceNamesForLabel(label).length).toBeGreaterThan(0);
    }
  });

  it("translates platform labels to ADAPTER run names (regression: name mismatch)", () => {
    // Run telemetry is stored under the adapter display name, not the
    // opportunity's platform label. The old sweep looked up runs by the label
    // and therefore never fired for Eventbrite/Devpost/etc.
    expect(getRunSourceNamesForLabel("Eventbrite")).toContain("Eventbrite Events");
    expect(getRunSourceNamesForLabel("Devpost")).toContain("Devpost Hackathons");
    expect(getRunSourceNamesForLabel("YCombinator")).toContain("YC Work at a Startup");
    expect(getRunSourceNamesForLabel("Internshala")).toEqual(["Internshala"]);
  });

  it("keeps every policy key consistent with its run-name map", () => {
    const policyLabels = Object.keys(SOURCE_SWEEP_POLICIES);
    const mappedLabels = Object.keys(SOURCE_LABEL_RUN_NAMES);
    expect(mappedLabels.sort()).toEqual(policyLabels.sort());
  });

  it("guards the Naukri policy with the direct adapter's sourceId prefix", () => {
    // Naukri is the one label both the direct crawler (naukri-<slug> ids) and
    // the JSearch platformMap (raw provider ids) can emit. The sweep must only
    // ever close records the direct crawler itself produced.
    expect(getSourceSweepPolicy("Naukri")?.sourceIdPrefix).toBe("naukri-");
    // Other swept labels carry no prefix guard — they are not JSearch-emittable.
    for (const label of ["Internshala", "RemoteOK", "Eventbrite", "Devpost", "RSS", "YCombinator"]) {
      expect(getSourceSweepPolicy(label)?.sourceIdPrefix).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// JSEARCH/NAUKRI COLLISION — SWEEP RECORD FILTER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("sweepRecordFilter — JSearch-family Naukri records are never swept", () => {
  const cutoff = new Date("2026-08-01T00:00:00Z");

  it("adds a sourceId prefix clause for the Naukri label", () => {
    const filter = sweepRecordFilter("Naukri", cutoff) as any;
    expect(filter.source).toBe("Naukri");
    expect(filter.isActive).toBe(true);
    expect(filter.lifecycleStatus).toEqual({ $ne: "archived" });
    expect(filter.lastSeenAt).toEqual({ $type: "date", $lt: cutoff });
    expect(filter.sourceId).toBeDefined();
    expect(filter.sourceId.$regex).toBeInstanceOf(RegExp);
  });

  it("matches the direct Naukri adapter's sourceId scheme", () => {
    const filter = sweepRecordFilter("Naukri", cutoff) as any;
    const re = filter.sourceId.$regex as RegExp;
    // Direct adapter: sourceId = `naukri-${slug}`
    expect(re.test("naukri-software-engineer-google-abc123")).toBe(true);
    expect(re.test("naukri-internship-xyz")).toBe(true);
  });

  it("does NOT match JSearch-derived Naukri records (raw provider ids)", () => {
    // Regression: the JSearch platformMap can emit source: "Naukri" with
    // sourceId = job.job_id (raw provider id, no "naukri-" prefix). Such a
    // record must never be absence-swept using the direct Naukri crawler's
    // run as evidence.
    const filter = sweepRecordFilter("Naukri", cutoff) as any;
    const re = filter.sourceId.$regex as RegExp;
    expect(re.test("7f3a2b1c9d0e")).toBe(false);
    expect(re.test("abc123")).toBe(false);
    expect(re.test("jsearch-7f3a2b1c")).toBe(false);
  });

  it("leaves non-colliding labels unrestricted (no sourceId clause)", () => {
    const internshala = sweepRecordFilter("Internshala", cutoff) as any;
    expect(internshala.sourceId).toBeUndefined();
    const eventbrite = sweepRecordFilter("Eventbrite", cutoff) as any;
    expect(eventbrite.sourceId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY ORPHAN RECONCILIATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("classifyLegacyOrphan", () => {
  const now = new Date("2026-09-05T00:00:00Z");

  it("activates a record still being seen by a live crawl", () => {
    expect(
      classifyLegacyOrphan({
        lastSeenAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        now,
        graceDays: 45,
      })
    ).toBe("activate");
  });

  it("closes a record unseen beyond the grace window", () => {
    expect(
      classifyLegacyOrphan({
        lastSeenAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        now,
        graceDays: 45,
      })
    ).toBe("close_unseen");
  });

  it("closes a record with no lastSeenAt at all", () => {
    expect(
      classifyLegacyOrphan({
        lastSeenAt: undefined,
        now,
        graceDays: 45,
      })
    ).toBe("close_unseen");
  });

  it("accepts ISO-string lastSeenAt", () => {
    expect(
      classifyLegacyOrphan({
        lastSeenAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        now,
        graceDays: 45,
      })
    ).toBe("activate");
  });
});

describe("isMissingSince", () => {
  const cutoff = new Date("2026-08-01T00:00:00Z");

  it("is missing when lastSeenAt predates the cutoff", () => {
    expect(isMissingSince(new Date("2026-07-01"), cutoff)).toBe(true);
  });

  it("is NOT missing when lastSeenAt is after the cutoff", () => {
    expect(isMissingSince(new Date("2026-09-01"), cutoff)).toBe(false);
  });

  it("is NOT missing when there is no lastSeenAt (cannot confirm absence)", () => {
    expect(isMissingSince(undefined, cutoff)).toBe(false);
    expect(isMissingSince(null, cutoff)).toBe(false);
  });
});

describe("reconcileLegacyOrphans (DB behavior)", () => {
  beforeEach(() => {
    const now = Date.now();
    orphanDb.setDocs([
      {
        _id: "fresh1",
        source: "Internshala",
        title: "Live listing, refreshed today",
        lastSeenAt: new Date(now - 6 * 60 * 60 * 1000), // seen 6h ago
      },
      {
        _id: "stale1",
        source: "Internshala",
        title: "Old listing, no lastSeenAt",
        // no lastSeenAt
      },
      {
        _id: "already-active",
        source: "Internshala",
        title: "Already has lifecycle status",
        lifecycleStatus: "active",
        isActive: true,
      },
    ]);
  });

  it("activates live orphans and closes unseen orphans (never deletes)", async () => {
    const result = await reconcileLegacyOrphans();
    expect(result.activated).toBe(1);
    expect(result.closedUnseen).toBe(1);

    const fresh = orphanDb.docs.find((d) => d._id === "fresh1")!;
    expect(fresh.lifecycleStatus).toBe("active");
    expect(fresh.isActive).toBe(true);

    const stale = orphanDb.docs.find((d) => d._id === "stale1")!;
    expect(stale.lifecycleStatus).toBe("closed");
    expect(stale.isActive).toBe(false);
    expect(stale.closedReason).toBe("legacy_orphan_unseen");

    // Records that already had a lifecycle status are untouched.
    const untouched = orphanDb.docs.find((d) => d._id === "already-active")!;
    expect(untouched.lifecycleStatus).toBe("active");
  });

  it("is idempotent — a second pass is a no-op", async () => {
    await reconcileLegacyOrphans();
    const second = await reconcileLegacyOrphans();
    expect(second.activated).toBe(0);
    expect(second.closedUnseen).toBe(0);
  });
});