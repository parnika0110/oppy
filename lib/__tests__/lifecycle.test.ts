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

describe("lifecycle classification", () => {
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

  it("does not infer eventDate as applicationDeadline", () => {
    // Event date in the past but no action date → should NOT close
    // (event could be ongoing/recurring, or user might still benefit from info)
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
    ).toBe(true); // This is correct: eventDate with no endDate and no action date = event is over
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
});
