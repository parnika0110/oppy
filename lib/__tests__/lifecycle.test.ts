import { describe, it, expect } from "vitest";

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
