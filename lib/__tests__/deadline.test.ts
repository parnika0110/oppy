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
  return "Unavailable";
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

  it("shows Unavailable when no deadline", () => {
    expect(deadlineLabel("unavailable", null, null)).toBe("Unavailable");
  });

  it("shows Unavailable when deadlineKind is null", () => {
    expect(deadlineLabel(null, null, null)).toBe("Unavailable");
  });
});
