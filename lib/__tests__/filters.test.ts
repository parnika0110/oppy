import { describe, it, expect } from "vitest";
import { publicOpportunityFilter, lifecycleFilter, buildCandidateFilter } from "@/lib/opportunities";

describe("lifecycleFilter", () => {
  it("returns active filter when showClosed is false", () => {
    const filter = lifecycleFilter(false);
    expect(filter).toHaveProperty("$or");
  });

  it("returns active+closed filter when showClosed is true", () => {
    const filter = lifecycleFilter(true);
    expect(filter).toHaveProperty("$and");
  });
});

describe("publicOpportunityFilter", () => {
  it("returns all active records with no filters", () => {
    const filter = publicOpportunityFilter({
      showClosed: false,
    });
    expect(filter).toHaveProperty("$and");
    const clauses = (filter as any).$and;
    expect(clauses.length).toBeGreaterThanOrEqual(1); // at least lifecycle filter
  });

  it("adds category filter when specified", () => {
    const filter = publicOpportunityFilter({
      category: "Job",
      showClosed: false,
    });
    const clauses = (filter as any).$and;
    const categoryClause = clauses.find((c: any) => c.category);
    expect(categoryClause).toBeDefined();
    expect(categoryClause.category).toBe("Job");
  });

  it("adds search filter when q is specified", () => {
    const filter = publicOpportunityFilter({
      q: "python",
      showClosed: false,
    });
    const clauses = (filter as any).$and;
    const searchClause = clauses.find((c: any) => c.$or);
    expect(searchClause).toBeDefined();
    expect(searchClause.$or.length).toBeGreaterThan(0);
  });

  it("adds remote filter when specified", () => {
    const filter = publicOpportunityFilter({
      remote: "true",
      showClosed: false,
    });
    const clauses = (filter as any).$and;
    const remoteClause = clauses.find(
      (c: any) => c.$or && c.$or.some((r: any) => r.isRemote !== undefined)
    );
    expect(remoteClause).toBeDefined();
  });

  it("excludes a record whose verified application deadline has passed (HackMIT case)", () => {
    const now = new Date();
    const filter = publicOpportunityFilter({ showClosed: false });
    const clauses = (filter as any).$and;
    const norClause = clauses.find((c: any) => c.$nor);
    expect(norClause).toBeDefined();
    const nor = norClause.$nor;
    // HackMIT-shaped doc with the source-verified July 4, 2026 deadline.
    const hackmit: {
      deadlineKind: string;
      deadline: Date;
      applicationDeadline: Date;
      registrationDeadline: Date | null;
    } = {
      deadlineKind: "verified",
      deadline: new Date("2026-07-04T23:59:00-04:00"),
      applicationDeadline: new Date("2026-07-04T23:59:00-04:00"),
      registrationDeadline: null,
    };
    const excluded = nor.some((cond: any) => {
      if (cond.deadlineKind?.$in) {
        return cond.deadlineKind.$in.includes(hackmit.deadlineKind) && hackmit.deadline.getTime() < now.getTime();
      }
      if (cond.applicationDeadline?.$type === "date") {
        return hackmit.applicationDeadline.getTime() < now.getTime();
      }
      if (cond.registrationDeadline?.$type === "date") {
        return hackmit.registrationDeadline !== null && hackmit.registrationDeadline.getTime() < now.getTime();
      }
      return false;
    });
    expect(excluded).toBe(true); // $nor matches -> definitively closed -> excluded from discovery
  });

  it("keeps a record discoverable while its verified deadline is still in the future", () => {
    const now = new Date();
    const filter = publicOpportunityFilter({ showClosed: false });
    const norClause = ((filter as any).$and as any[]).find((c: any) => c.$nor);
    const future: {
      deadlineKind: string;
      deadline: Date;
      applicationDeadline: Date;
      registrationDeadline: Date | null;
    } = {
      deadlineKind: "verified",
      deadline: new Date("2099-07-04T23:59:00-04:00"),
      applicationDeadline: new Date("2099-07-04T23:59:00-04:00"),
      registrationDeadline: null,
    };
    const excluded = norClause.$nor.some((cond: any) => {
      if (cond.deadlineKind?.$in) {
        return cond.deadlineKind.$in.includes(future.deadlineKind) && future.deadline.getTime() < now.getTime();
      }
      if (cond.applicationDeadline?.$type === "date") {
        return future.applicationDeadline.getTime() < now.getTime();
      }
      if (cond.registrationDeadline?.$type === "date") {
        return future.registrationDeadline !== null && future.registrationDeadline.getTime() < now.getTime();
      }
      return false;
    });
    expect(excluded).toBe(false); // not matched by $nor -> stays in discovery
  });

  it("composes multiple filters", () => {
    const filter = publicOpportunityFilter({
      category: "Internship",
      remote: "true",
      q: "python",
      showClosed: false,
    });
    const clauses = (filter as any).$and;
    expect(clauses.length).toBeGreaterThanOrEqual(4); // lifecycle + category + remote + search
  });

  it("ignores invalid categories", () => {
    const filter = publicOpportunityFilter({
      category: "InvalidCategory",
      showClosed: false,
    });
    const clauses = (filter as any).$and;
    const categoryClause = clauses.find((c: any) => c.category);
    expect(categoryClause).toBeUndefined(); // invalid category should not add filter
  });

  it("adds showClosed filter when true", () => {
    const filter = publicOpportunityFilter({
      showClosed: true,
    });
    const clauses = (filter as any).$and;
    expect(clauses.length).toBeGreaterThanOrEqual(1);
  });

  it("excludes safety-blocked records by default", () => {
    const filter = publicOpportunityFilter({ showClosed: false });
    const clauses = (filter as any).$and;
    const safetyClause = clauses.find(
      (c: any) => c.$or && c.$or.some((r: any) => r.safety !== undefined)
    );
    expect(safetyClause).toBeDefined();
    const alternatives = safetyClause.$or;
    // Records without a safety field stay visible; blocked records are excluded.
    expect(alternatives).toContainEqual({ safety: { $exists: false } });
    expect(alternatives).toContainEqual({ "safety.level": { $ne: "blocked" } });
  });

  it("does not apply the safety exclusion when showClosed is true", () => {
    const filter = publicOpportunityFilter({ showClosed: true });
    const clauses = (filter as any).$and;
    const safetyClause = clauses.find(
      (c: any) => c.$or && c.$or.some((r: any) => r.safety !== undefined)
    );
    expect(safetyClause).toBeUndefined();
  });
});

describe("buildCandidateFilter — safety exclusion", () => {
  it("excludes safety-blocked records from the recommendation candidate pool", () => {
    const filter = buildCandidateFilter({});
    const clauses = (filter as any).$and;
    const safetyClause = clauses.find(
      (c: any) => c.$or && c.$or.some((r: any) => r.safety !== undefined)
    );
    expect(safetyClause).toBeDefined();
    expect(safetyClause.$or).toContainEqual({ "safety.level": { $ne: "blocked" } });
  });
});
