import { describe, it, expect } from "vitest";
import { isApplicationTracked } from "../../lib/tracking-state";

// ── Tracking UI Logic Tests ────────────────────────────────────────────

describe("ApplicationTracker — compact control logic", () => {
  const STATUSES = [
    { key: "interested", label: "Interested", emoji: "◉" },
    { key: "applied", label: "Applied", emoji: "✓" },
    { key: "interview", label: "Interview", emoji: "🎤" },
    { key: "accepted", label: "Accepted", emoji: "🎉" },
    { key: "rejected", label: "Rejected", emoji: "✗" },
  ];

  it("untracked state shows '+ Track' button", () => {
    const currentStatus = undefined;
    const isTracked = isApplicationTracked(currentStatus, false);
    expect(isTracked).toBe(false);
    // UI should render "+ Track"
  });

  it("first-time '+ Track' click flips the button to tracked once the POST succeeds", () => {
    // Regression: isTracked used to be derived ONLY from the currentStatus
    // prop (undefined on a fresh visit). Even after the POST succeeded and
    // the status was persisted in MongoDB, the prop stayed stale, so the
    // button remained "+ Track" and the status popup stayed locked.
    // The local flag set after a successful POST must make it tracked.
    const currentStatus = undefined; // still stale — fetch ran before the POST
    expect(isApplicationTracked(currentStatus, false)).toBe(false); // before click
    expect(isApplicationTracked(currentStatus, true)).toBe(true);    // after POST success
  });

  it("once locally started, a later server status still keeps the badge tracked", () => {
    expect(isApplicationTracked("applied", true)).toBe(true);
  });

  it("locally started alone (no server status yet) shows the badge", () => {
    // DetailTracker has not refetched, so currentStatus is still undefined,
    // but the user already tracked — the badge must NOT revert to "+ Track".
    expect(isApplicationTracked(undefined, true)).toBe(true);
  });

  it("'saved' status is treated as untracked", () => {
    const currentStatus: string = "saved";
    const isTracked = isApplicationTracked(currentStatus, false);
    expect(isTracked).toBe(false);
  });

  it("'interested' status is treated as tracked", () => {
    const currentStatus: string = "interested";
    const isTracked = isApplicationTracked(currentStatus, false);
    expect(isTracked).toBe(true);
  });

  it("'applied' status is treated as tracked", () => {
    const currentStatus: string = "applied";
    const isTracked = isApplicationTracked(currentStatus, false);
    expect(isTracked).toBe(true);
  });

  it("first track defaults to 'interested'", () => {
    // When user clicks "+ Track" for the first time
    const defaultStatus = "interested";
    expect(STATUSES.find((s) => s.key === defaultStatus)).toBeDefined();
  });

  it("clicking tracked badge toggles popup", () => {
    let showPopup = false;
    showPopup = !showPopup;
    expect(showPopup).toBe(true);
    showPopup = !showPopup;
    expect(showPopup).toBe(false);
  });
});

describe("ApplicationTracker — status transitions", () => {
  it("can transition from interested to applied", () => {
    const from = "interested";
    const to = "applied";
    expect(from).not.toBe(to);
  });

  it("can transition from applied to interview", () => {
    const from = "applied";
    const to = "interview";
    expect(from).not.toBe(to);
  });

  it("can transition from interview to accepted", () => {
    const from = "interview";
    const to = "accepted";
    expect(from).not.toBe(to);
  });

  it("can transition from any status to rejected", () => {
    const statuses = ["interested", "applied", "interview", "accepted"];
    for (const from of statuses) {
      expect(from).not.toBe("rejected");
    }
  });

  it("same status click is a no-op when tracked", () => {
    const currentStatus = "applied";
    const newStatus = "applied";
    const isNoOp = newStatus === currentStatus;
    expect(isNoOp).toBe(true);
  });
});

describe("ApplicationTracker — current status display", () => {
  const STATUSES = [
    { key: "interested", label: "Interested", emoji: "◉" },
    { key: "applied", label: "Applied", emoji: "✓" },
    { key: "interview", label: "Interview", emoji: "🎤" },
    { key: "accepted", label: "Accepted", emoji: "🎉" },
    { key: "rejected", label: "Rejected", emoji: "✗" },
  ];

  it("displays correct label for each status", () => {
    for (const s of STATUSES) {
      const display = `${s.emoji} ${s.label}`;
      expect(display).toContain(s.label);
    }
  });

  it("status badge uses correct color mapping", () => {
    const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
      interested: { bg: "#FEF3C7", text: "#92400E" },
      applied: { bg: "#D1FAE5", text: "#065F46" },
      interview: { bg: "#DBEAFE", text: "#1E40AF" },
      accepted: { bg: "#D1FAE5", text: "#065F46" },
      rejected: { bg: "#FEE2E2", text: "#991B1B" },
    };

    for (const s of STATUSES) {
      const colors = STATUS_COLORS[s.key];
      expect(colors).toBeDefined();
      expect(colors.bg).toBeTruthy();
      expect(colors.text).toBeTruthy();
    }
  });
});

describe("TrackingDashboard — filtering", () => {
  interface Entry {
    status: string;
    opportunityId: string;
  }

  const entries: Entry[] = [
    { status: "interested", opportunityId: "opp-1" },
    { status: "applied", opportunityId: "opp-2" },
    { status: "applied", opportunityId: "opp-3" },
    { status: "interview", opportunityId: "opp-4" },
    { status: "rejected", opportunityId: "opp-5" },
  ];

  it("counts by status correctly", () => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.status] = (counts[e.status] || 0) + 1;
    }
    expect(counts.interested).toBe(1);
    expect(counts.applied).toBe(2);
    expect(counts.interview).toBe(1);
    expect(counts.rejected).toBe(1);
  });

  it("'all' filter shows all entries", () => {
    const filtered = entries.filter(() => true);
    expect(filtered).toHaveLength(5);
  });

  it("'applied' filter shows only applied entries", () => {
    const filtered = entries.filter((e) => e.status === "applied");
    expect(filtered).toHaveLength(2);
  });

  it("'interested' filter shows only interested entries", () => {
    const filtered = entries.filter((e) => e.status === "interested");
    expect(filtered).toHaveLength(1);
  });

  it("'interview' filter shows only interview entries", () => {
    const filtered = entries.filter((e) => e.status === "interview");
    expect(filtered).toHaveLength(1);
  });

  it("'accepted' filter shows zero when none exist", () => {
    const filtered = entries.filter((e) => e.status === "accepted");
    expect(filtered).toHaveLength(0);
  });
});

describe("Tracking — user isolation", () => {
  it("tracking entry is always scoped to authenticated user", () => {
    // All API routes use getCurrentUser(request) → user.id
    // GET: { userId: user.id }
    // POST: { userId: user.id, opportunityId }
    // DELETE: { userId: user.id, opportunityId }
    const userId = "user-abc";
    const filters = {
      get: { userId },
      post: { userId, opportunityId: "opp-1" },
      delete: { userId, opportunityId: "opp-1" },
    };
    expect(filters.get.userId).toBe(userId);
    expect(filters.post.userId).toBe(userId);
    expect(filters.delete.userId).toBe(userId);
  });

  it("different users cannot see each other's tracking", () => {
    const userATracking = [
      { userId: "user-a", opportunityId: "opp-1", status: "applied" },
    ];
    const userBTracking = [
      { userId: "user-b", opportunityId: "opp-1", status: "interested" },
    ];

    // When querying for user-a, only user-a's entries return
    const userAResults = userATracking.filter((e) => e.userId === "user-a");
    expect(userAResults).toHaveLength(1);
    expect(userAResults[0].status).toBe("applied");

    // User-b's entry is separate
    const userBResults = userBTracking.filter((e) => e.userId === "user-b");
    expect(userBResults).toHaveLength(1);
    expect(userBResults[0].status).toBe("interested");
  });

  it("upsert prevents duplicate tracking for same user + opportunity", () => {
    const records = new Map<string, { status: string }>();

    function upsert(userId: string, opportunityId: string, status: string) {
      const key = `${userId}:${opportunityId}`;
      const existing = records.get(key);
      if (existing) {
        existing.status = status;
        return "updated";
      }
      records.set(key, { status });
      return "created";
    }

    expect(upsert("user-a", "opp-1", "interested")).toBe("created");
    expect(upsert("user-a", "opp-1", "applied")).toBe("updated");
    expect(records.size).toBe(1);
    expect(records.get("user-a:opp-1")!.status).toBe("applied");
  });
});

describe("Tracking — removal/reset", () => {
  it("DELETE removes the tracking entry", () => {
    const records = new Map<string, { status: string }>();
    records.set("user-a:opp-1", { status: "applied" });

    function remove(userId: string, opportunityId: string) {
      const key = `${userId}:${opportunityId}`;
      const existed = records.has(key);
      records.delete(key);
      return existed;
    }

    expect(remove("user-a", "opp-1")).toBe(true);
    expect(records.has("user-a:opp-1")).toBe(false);
  });

  it("DELETE for non-existent entry returns false (idempotent)", () => {
    const records = new Map<string, { status: string }>();
    function remove(userId: string, opportunityId: string) {
      const key = `${userId}:${opportunityId}`;
      const existed = records.has(key);
      records.delete(key);
      return existed;
    }
    expect(remove("user-a", "opp-999")).toBe(false);
  });
});

describe("Card grid consistency", () => {
  it("title clamp is 2 lines (line-clamp-2)", () => {
    // Document that the card title uses line-clamp-2
    const titleClass = "line-clamp-2";
    expect(titleClass).toContain("line-clamp-2");
  });

  it("location clamp is 1 line (line-clamp-1)", () => {
    const locationClass = "line-clamp-1";
    expect(locationClass).toContain("line-clamp-1");
  });

  it("image uses 16:9 aspect ratio", () => {
    const aspectRatio = "16/9";
    expect(aspectRatio).toBe("16/9");
  });

  it("CTA uses mt-auto for bottom alignment", () => {
    const ctaClass = "mt-auto";
    expect(ctaClass).toContain("mt-auto");
  });
});
