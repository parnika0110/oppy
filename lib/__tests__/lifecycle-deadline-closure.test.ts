import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshOpportunityLifecycle } from "@/lib/lifecycle";

/**
 * Focused in-memory double for refreshOpportunityLifecycle.
 *
 * The real function touches: the deadline-close loop (find + updateOne), the
 * legacy-orphan reconciliation (find with lifecycleStatus $exists + updateOne),
 * and the source-removal sweep (distinct + ingestionRuns.findOne + updateMany).
 * With no ingestion runs and an empty distinct set, the sweep no-ops.
 */
const state = vi.hoisted(() => {
  const s: {
    docs: Array<Record<string, unknown> & { _id: string }>;
    closeCalls: number;
  } = { docs: [], closeCalls: 0 };
  const matches = (d: Record<string, unknown>, filter: any): boolean => {
    if (filter.isActive === true && d.isActive !== true) return false;
    if (filter.lifecycleStatus?.$ne && d.lifecycleStatus === filter.lifecycleStatus.$ne) return false;
    if (filter.lifecycleStatus?.$exists === false && "lifecycleStatus" in d) return false;
    return true;
  };
  const collection = {
    find(filter: any = {}) {
      const hits = s.docs.filter((d) => matches(d, filter));
      return {
        [Symbol.asyncIterator]: async function* () {
          for (const m of hits) yield m;
        },
      };
    },
    async distinct() {
      return []; // no sources -> sweep loop no-ops
    },
    async updateOne(filter: any, update: any) {
      const doc = s.docs.find((d) => String(d._id) === String(filter._id));
      if (doc && !(filter.lifecycleStatus?.$ne && doc.lifecycleStatus === filter.lifecycleStatus.$ne)) {
        Object.assign(doc, update.$set);
        if (update.$set.lifecycleStatus === "closed") s.closeCalls++;
        return { modifiedCount: 1 };
      }
      return { modifiedCount: 0 };
    },
    async updateMany() {
      return { modifiedCount: 0 };
    },
  };
  return {
    setDocs(docs: typeof s.docs) {
      s.docs = docs;
      s.closeCalls = 0;
    },
    get docs() {
      return s.docs;
    },
    get closeCalls() {
      return s.closeCalls;
    },
    get collection() {
      return collection;
    },
  };
});

vi.mock("@/lib/mongodb", () => ({
  getOpportunitiesCollection: async () => state.collection,
  getIngestionRunsCollection: async () => ({ findOne: async () => null }),
}));

const HACKMIT_DEADLINE = new Date("2026-07-04T23:59:00-04:00");

function hackmitDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: "hackmit-test",
    title: "HackMIT",
    organization: "MIT",
    source: "MIT",
    deadlineKind: "verified",
    deadline: HACKMIT_DEADLINE,
    applicationDeadline: HACKMIT_DEADLINE,
    registrationDeadline: null,
    eventDate: null,
    eventEndDate: null,
    lifecycleStatus: "active",
    isActive: true,
    ...overrides,
  };
}

describe("refreshOpportunityLifecycle — deadline closure (HackMIT)", () => {
  beforeEach(() => {
    state.setDocs([]);
  });

  it("closes an active record whose verified deadline has passed (July 4, 2026)", async () => {
    state.setDocs([hackmitDoc()]);
    await refreshOpportunityLifecycle();
    const doc = state.docs[0];
    expect(doc.lifecycleStatus).toBe("closed");
    expect(doc.isActive).toBe(false);
    expect(doc.closedReason).toBe("deadline_passed");
    expect(state.closeCalls).toBe(1);
  });

  it("does NOT close while the verified deadline is still in the future", async () => {
    state.setDocs([
      hackmitDoc({
        deadline: new Date("2099-07-04T23:59:00-04:00"),
        applicationDeadline: new Date("2099-07-04T23:59:00-04:00"),
      }),
    ]);
    await refreshOpportunityLifecycle();
    expect(state.docs[0].lifecycleStatus).toBe("active");
    expect(state.docs[0].isActive).toBe(true);
    expect(state.closeCalls).toBe(0);
  });

  it("does NOT close when the deadline is unavailable (current production state)", async () => {
    state.setDocs([
      hackmitDoc({
        deadlineKind: "unavailable",
        deadline: null,
        applicationDeadline: null,
      }),
    ]);
    await refreshOpportunityLifecycle();
    expect(state.docs[0].lifecycleStatus).toBe("active");
    expect(state.closeCalls).toBe(0);
  });

  it("never touches archived records", async () => {
    state.setDocs([hackmitDoc({ lifecycleStatus: "archived" })]);
    await refreshOpportunityLifecycle();
    expect(state.docs[0].lifecycleStatus).toBe("archived");
    expect(state.closeCalls).toBe(0);
  });
});