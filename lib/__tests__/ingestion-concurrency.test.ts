/**
 * Single-source concurrency regression tests.
 *
 * Root cause being guarded: single-source runs (e.g. the manual
 * {"source":"JSearch"} Lambda invocations) used to bypass the ingestion lock,
 * which let two overlapping JSearch runs double-spend the paid API quota
 * (observed: two 88-request runs overlapped).
 *
 * Fix: runIngestionPipeline() now acquires the Mongo lock for EVERY run —
 * full pipeline or single-source — BEFORE any provider fetch. A run that
 * loses the lock race exits cleanly with zero external requests.
 *
 * These tests run the REAL pipeline against a mocked MongoDB whose
 * ingestionLock collection faithfully emulates the atomic findOneAndUpdate
 * upsert + duplicate-key semantics, and a mocked JSearch adapter whose fetch()
 * is gated by a deferred promise so the winner can be held mid-run while the
 * loser attempts to start.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";

// ── In-memory MongoDB double (real lock semantics) ──────────────────────────

const mongo = vi.hoisted(() => {
  type LockDoc = { expiresAt: Date; lockId: string };
  const locks = new Map<string, LockDoc>();

  const cursor = () => ({
    sort: () => ({
      limit: () => ({ toArray: async () => [] }),
      toArray: async () => [],
    }),
    limit: () => ({ toArray: async () => [] }),
    toArray: async () => [],
    [Symbol.asyncIterator]: async function* () {},
  });

  const genericCollection = () => ({
    findOne: async () => null,
    find: () => cursor(),
    findOneAndUpdate: async () => ({ value: null }),
    updateOne: async () => ({ matchedCount: 1 }),
    updateMany: async () => ({ matchedCount: 0 }),
    insertOne: async () => ({ insertedId: "mock-id" }),
    insertMany: async () => ({ insertedCount: 0 }),
    deleteOne: async () => ({ deletedCount: 0 }),
  });

  const lockCollection = () => ({
    // Emulate: { _id, expiresAt: { $lte: now } } + $set + upsert.
    // - No doc / expired doc → upsert overwrites/inserts (acquired).
    // - Live doc → upsert tries to insert → duplicate key (code 11000).
    async findOneAndUpdate(filter: any, update: any) {
      const id: string = filter._id;
      const now = new Date();
      const existing = locks.get(id);
      if (existing && existing.expiresAt > now) {
        const err: any = new Error("E11000 duplicate key error");
        err.code = 11000;
        throw err;
      }
      const next: LockDoc = {
        expiresAt: new Date(update.$set.expiresAt),
        lockId: update.$set.lockId,
      };
      locks.set(id, next);
      return { value: existing ? { ...existing } : null };
    },
    async findOne(filter: any) {
      const doc = locks.get(filter._id);
      return doc ? { ...doc } : null;
    },
    async deleteOne(filter: any) {
      locks.delete(filter._id);
      return { deletedCount: 1 };
    },
  });

  return {
    locks,
    db: {
      collection: (name: string) =>
        name === "ingestionLock" ? lockCollection() : genericCollection(),
    },
  };
});

// ── Gated JSearch adapter mock ─────────────────────────────────────────────

const jsearch = vi.hoisted(() => ({
  fetchCalls: 0,
  fetchStarted: false,
  release: null as null | ((value: unknown[]) => void),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: async () => mongo.db,
  getOpportunitiesCollection: async () => mongo.db.collection("opportunities"),
  getIngestionRunsCollection: async () => mongo.db.collection("ingestionRuns"),
}));

vi.mock("@/lib/ingestion/sources/jsearch", () => ({
  JSearchSource: class {
    name = "JSearch (LinkedIn/Indeed/Glassdoor/Naukri)";
    platform = "JSearch";
    async fetch(): Promise<unknown[]> {
      jsearch.fetchCalls++;
      jsearch.fetchStarted = true;
      return new Promise((resolve) => {
        jsearch.release = resolve;
      });
    }
  },
}));

import { runIngestionPipeline } from "@/lib/ingestion";

beforeEach(() => {
  jsearch.fetchCalls = 0;
  jsearch.fetchStarted = false;
  jsearch.release = null;
  mongo.locks.clear();
});

describe("single-source concurrency lock", () => {
  it("two concurrent JSearch runs cannot both proceed", async () => {
    // Start run #1 and wait until it has acquired the lock and reached fetch()
    // (i.e. it is mid-run, holding the lock).
    const run1 = runIngestionPipeline("JSearch");
    await vi.waitFor(
      () => {
        expect(jsearch.fetchStarted).toBe(true);
      },
      { timeout: 5000, interval: 10 }
    );

    // Start run #2 while run #1 is still holding the lock.
    const run2 = runIngestionPipeline("JSearch");
    const result2 = await run2;

    expect(result2.lockAcquired).toBe(false);
    expect(result2.totalFetched).toBe(0);
    expect(result2.totalInserted).toBe(0);
    expect(jsearch.fetchCalls).toBe(1); // loser never reached fetch → no provider request

    // Let run #1 finish.
    jsearch.release!([{ title: "placeholder" }]);
    const result1 = await run1;
    expect(result1.lockAcquired).toBe(true);
    expect(jsearch.fetchCalls).toBe(1);
  });

  it("a run that loses the lock exits cleanly (no provider requests)", async () => {
    const run1 = runIngestionPipeline("JSearch");
    await vi.waitFor(
      () => {
        expect(jsearch.fetchStarted).toBe(true);
      },
      { timeout: 5000, interval: 10 }
    );

    const run2 = runIngestionPipeline("JSearch");
    const result2 = await run2;

    // Clean early-exit result: no throw, zero work, lock not held by us.
    expect(result2.lockAcquired).toBe(false);
    expect(result2.sourceResults).toEqual([]);
    expect(result2.durationMs).toBe(0);

    jsearch.release!([]);
    await run1;
  });

  it("sequential single-source runs both proceed (lock released between runs)", async () => {
    const run1 = runIngestionPipeline("JSearch");
    await vi.waitFor(
      () => {
        expect(jsearch.fetchStarted).toBe(true);
      },
      { timeout: 5000, interval: 10 }
    );
    jsearch.release!([]);
    const result1 = await run1;
    expect(result1.lockAcquired).toBe(true);

    // Second run must be able to acquire the now-released lock.
    jsearch.fetchStarted = false;
    const run2 = runIngestionPipeline("JSearch");
    await vi.waitFor(
      () => {
        expect(jsearch.fetchStarted).toBe(true);
      },
      { timeout: 5000, interval: 10 }
    );
    jsearch.release!([]);
    const result2 = await run2;
    expect(result2.lockAcquired).toBe(true);
    expect(jsearch.fetchCalls).toBe(2);
  });

  it("a different single-source run cannot overlap a running JSearch run", async () => {
    // JSearch and LinkedIn share the same provider/quota, so even two DIFFERENT
    // single-source runs must not overlap. Start JSearch, then try LinkedIn
    // while the lock is held: LinkedIn must be refused before any fetch.
    const runJSearch = runIngestionPipeline("JSearch");
    await vi.waitFor(
      () => {
        expect(jsearch.fetchStarted).toBe(true);
      },
      { timeout: 5000, interval: 10 }
    );

    const runLinkedIn = runIngestionPipeline("LinkedIn");
    const linkedInResult = await runLinkedIn;

    expect(linkedInResult.lockAcquired).toBe(false);
    expect(linkedInResult.totalFetched).toBe(0);
    expect(jsearch.fetchCalls).toBe(1); // LinkedIn never reached fetch

    jsearch.release!([]);
    const jSearchResult = await runJSearch;
    expect(jSearchResult.lockAcquired).toBe(true);
  });

  it("the pipeline always acquires the lock (no single-source bypass remains)", () => {
    // Regression guard against re-introducing the isSingleSource lock bypass.
    const code = readFileSync("lib/ingestion/index.ts", "utf8");
    expect(code).not.toContain("if (!isSingleSource)");
    expect(code).toContain("const lockAcquired = await acquireLock();");
    expect(code).toContain("if (!lockAcquired)");
    expect(code).toContain("if (lockAcquired)");
  });
});
