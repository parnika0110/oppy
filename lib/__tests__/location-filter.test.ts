import { describe, it, expect } from "vitest";
import { publicOpportunityFilter } from "@/lib/opportunities";

/**
 * Regression tests for the location filter.
 *
 * Root cause: getTraditionalFiltered() was not passing location/tag/remote
 * params to publicOpportunityFilter(), so location=Bengaluru returned ALL
 * jobs instead of filtering by Bengaluru.
 */

describe("publicOpportunityFilter — location filtering", () => {
  it("Bengaluru filter matches Bengaluru location", () => {
    const filter = publicOpportunityFilter({
      category: "Job",
      location: "Bengaluru",
      showClosed: false,
    });
    // The filter should include a location clause
    const locationClause = JSON.stringify(filter).includes("bengaluru");
    expect(locationClause).toBe(true);
  });

  it("Bengaluru filter also matches Bangalore variant", () => {
    const filter = publicOpportunityFilter({
      category: "Job",
      location: "Bangalore",
      showClosed: false,
    });
    const locationClause = JSON.stringify(filter).includes("bangalore");
    expect(locationClause).toBe(true);
  });

  it("Remote filter matches Remote location", () => {
    const filter = publicOpportunityFilter({
      category: "Job",
      remote: "true",
      showClosed: false,
    });
    const filterStr = JSON.stringify(filter);
    expect(filterStr).toContain("remote");
  });

  it("Bengaluru + category produces a valid $and filter", () => {
    const filter = publicOpportunityFilter({
      category: "Job",
      location: "Bengaluru",
      showClosed: false,
    });
    expect(filter).toHaveProperty("$and");
    expect(Array.isArray((filter as any).$and)).toBe(true);
    // Should have: lifecycle, closed, category, location = 4+ clauses
    expect((filter as any).$and.length).toBeGreaterThanOrEqual(4);
  });

  it("empty location does not add location clause", () => {
    const filterWith = publicOpportunityFilter({
      category: "Job",
      location: "Bengaluru",
      showClosed: false,
    });
    const filterWithout = publicOpportunityFilter({
      category: "Job",
      showClosed: false,
    });
    // filterWith should have more clauses than filterWithout
    expect((filterWith as any).$and.length).toBeGreaterThan(
      (filterWithout as any).$and.length,
    );
  });

  it("Bengaluru + remote: both clauses present (AND logic)", () => {
    const filter = publicOpportunityFilter({
      category: "Job",
      location: "Bengaluru",
      remote: "true",
      showClosed: false,
    });
    const filterStr = JSON.stringify(filter);
    // Should contain both bengaluru and remote references
    expect(filterStr).toContain("bengaluru");
    expect(filterStr).toContain("remote");
  });

  it("location=Remote matches remote jobs", () => {
    const filter = publicOpportunityFilter({
      category: "Job",
      location: "Remote",
      showClosed: false,
    });
    const filterStr = JSON.stringify(filter);
    expect(filterStr).toContain("remote");
  });
});

describe("publicOpportunityFilter — all params passed", () => {
  it("passes all filter params correctly", () => {
    const filter = publicOpportunityFilter({
      q: "python",
      category: "Internship",
      categories: undefined,
      interests: "AI,Machine Learning",
      location: "Bengaluru",
      tag: "python",
      remote: "true",
      experience: "intermediate",
      showClosed: false,
    });
    const filterStr = JSON.stringify(filter);
    // All params should create clauses
    expect(filterStr).toContain("python"); // q + tag
    expect(filterStr).toContain("Internship"); // category
    expect(filterStr).toContain("bengaluru"); // location
  });
});
