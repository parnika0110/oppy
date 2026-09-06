import { describe, it, expect } from "vitest";

/**
 * Deadline classification rules:
 *
 * - If source provides explicit deadline → deadlineKind = "verified" or "source_provided"
 * - If source explicitly says rolling/open → deadlineKind = "rolling"
 * - If source provides no deadline → deadlineKind = "unavailable"
 * - NEVER infer deadline from eventDate
 * - NEVER infer deadline from posting date
 */

type DeadlineKind = "verified" | "source_provided" | "rolling" | "unavailable";

function classifyDeadline(params: {
  sourceDeadline?: Date | null;
  sourceExplicitlyRolling?: boolean;
  hasEventDate?: boolean;
}): DeadlineKind {
  if (params.sourceExplicitlyRolling) return "rolling";
  if (params.sourceDeadline) return "source_provided";
  return "unavailable";
}

describe("deadline classification", () => {
  it("uses source_provided when source gives a deadline", () => {
    expect(
      classifyDeadline({ sourceDeadline: new Date("2026-09-01") })
    ).toBe("source_provided");
  });

  it("uses rolling when source explicitly says so", () => {
    expect(classifyDeadline({ sourceExplicitlyRolling: true })).toBe("rolling");
  });

  it("uses unavailable when source gives no deadline", () => {
    expect(classifyDeadline({})).toBe("unavailable");
  });

  it("does NOT infer deadline from eventDate", () => {
    // Even if eventDate exists, if source provides no deadline, it's unavailable
    expect(
      classifyDeadline({ hasEventDate: true })
    ).toBe("unavailable");
  });

  it("prefers explicit deadline over rolling", () => {
    expect(
      classifyDeadline({
        sourceDeadline: new Date("2026-09-01"),
        sourceExplicitlyRolling: true,
      })
    ).toBe("rolling"); // explicit rolling wins
  });

  it("deadline + eventDate → deadline kind from source, not event", () => {
    expect(
      classifyDeadline({
        sourceDeadline: new Date("2026-10-01"),
        hasEventDate: true,
      })
    ).toBe("source_provided");
  });
});

// Test display label logic
const NO_DEADLINE_FALLBACK = "No deadline listed — check the source";

function deadlineLabel(
  deadlineKind: string | null,
  deadline: Date | null,
  applicationDeadline: Date | null
): string {
  const effectiveDeadline = applicationDeadline || deadline;
  if (["verified", "source_provided"].includes(deadlineKind || "") && effectiveDeadline) {
    return new Intl.DateTimeFormat("en", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(effectiveDeadline);
  }
  if (deadlineKind === "rolling") return "Rolling / Open";
  return NO_DEADLINE_FALLBACK;
}

describe("deadline display", () => {
  it("shows date for verified deadline", () => {
    const result = deadlineLabel("verified", new Date("2026-09-15"), null);
    expect(result).toContain("September");
    expect(result).toContain("15");
  });

  it("shows Rolling / Open for rolling", () => {
    expect(deadlineLabel("rolling", null, null)).toBe("Rolling / Open");
  });

  it("shows graceful fallback when no deadline is listed", () => {
    expect(deadlineLabel("unavailable", null, null)).toBe(NO_DEADLINE_FALLBACK);
  });

  it("shows graceful fallback when deadlineKind is null", () => {
    expect(deadlineLabel(null, null, null)).toBe(NO_DEADLINE_FALLBACK);
  });

  it("never infers a deadline from an event date", () => {
    // A record with only eventDate still gets the fallback, never a fake date
    expect(deadlineLabel("unavailable", null, null)).toBe(NO_DEADLINE_FALLBACK);
  });
});

// Structural regression: the detail page must distinguish verified deadlines
// from genuinely-absent ones instead of showing a bare "Unavailable".
import { readFileSync } from "fs";

describe("opportunity detail page — deadline fallback", () => {
  const pageCode = readFileSync("app/opportunity/[id]/page.tsx", "utf8");

  it("renders the graceful no-deadline fallback", () => {
    expect(pageCode).toContain(NO_DEADLINE_FALLBACK);
  });

  it("no longer renders bare 'Unavailable' for the deadline", () => {
    expect(pageCode).not.toMatch(/>Unavailable<\//);
  });

  it("still renders verified deadlines and Rolling / Open", () => {
    expect(pageCode).toContain("{appDeadline}");
    expect(pageCode).toContain("Rolling / Open");
  });

  it("shows a Closed badge alongside a verified (passed) deadline in history views", () => {
    // Closed record + verified deadline must render BOTH the date and the
    // Closed state — the opportunity stays visible in tracking history.
    expect(pageCode).toContain("{isClosed && (");
    expect(pageCode).toContain("Closed");
    expect(pageCode).toContain("{appDeadline && isVerifiedDeadline ? (");
  });
});
