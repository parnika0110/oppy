/**
 * JSearch request-plan tests.
 *
 * Verifies the new small student-focused strategy: India always present,
 * Bengaluru/remote anchors India-only, one rotating international market per
 * run, and a ~10-20 request per-cycle budget (down from the old 11x8 = 88 grid).
 */

import { describe, it, expect } from "vitest";
import {
  getJSearchPlanPairs,
  getJSearchRotationCountry,
  JSEARCH_CORE_QUERIES,
  JSEARCH_INDIA_ANCHOR_QUERIES,
  JSEARCH_ROTATION_COUNTRIES,
  JSEARCH_HOME_COUNTRY,
  JSEARCH_PLAN_REQUEST_COUNT,
} from "@/lib/ingestion/jsearch-plan";

describe("JSearch plan — request count", () => {
  it("uses roughly 10-20 requests per cycle, not 88", () => {
    expect(JSEARCH_PLAN_REQUEST_COUNT).toBeGreaterThanOrEqual(10);
    expect(JSEARCH_PLAN_REQUEST_COUNT).toBeLessThanOrEqual(20);
    expect(JSEARCH_PLAN_REQUEST_COUNT).toBeLessThan(30);
  });

  it("matches core*2 + anchors formula", () => {
    const expected =
      JSEARCH_CORE_QUERIES.length * 2 + JSEARCH_INDIA_ANCHOR_QUERIES.length;
    expect(JSEARCH_PLAN_REQUEST_COUNT).toBe(expected);
  });

  it("produces exactly the expected number of (country, query) pairs", () => {
    for (let day = 0; day < 14; day++) {
      expect(getJSearchPlanPairs(day)).toHaveLength(JSEARCH_PLAN_REQUEST_COUNT);
    }
  });

  it("stays within the default per-run request budget", () => {
    // Default budget is 16; the 14-request plan must fit inside it with headroom.
    expect(JSEARCH_PLAN_REQUEST_COUNT).toBeLessThanOrEqual(16);
  });
});

describe("JSearch plan — India-first coverage", () => {
  it("always includes India (IN)", () => {
    for (let day = 0; day < 21; day++) {
      const countries = getJSearchPlanPairs(day).map((p) => p.country);
      expect(countries).toContain(JSEARCH_HOME_COUNTRY);
    }
  });

  it("keeps the Bengaluru/remote anchors India-only", () => {
    for (const anchor of JSEARCH_INDIA_ANCHOR_QUERIES) {
      // Anchor queries must only ever be paired with IN.
      for (let day = 0; day < 14; day++) {
        const pair = getJSearchPlanPairs(day).find((p) => p.query === anchor);
        expect(pair).toBeDefined();
        expect(pair!.country).toBe(JSEARCH_HOME_COUNTRY);
      }
    }
  });

  it("contains Bengaluru and remote intent in the India anchors", () => {
    expect(JSEARCH_INDIA_ANCHOR_QUERIES).toEqual([
      "Software Engineering Intern Bengaluru",
      "internship Bengaluru remote",
    ]);
  });
});

describe("JSearch plan — international rotation", () => {
  it("rotates through every international market over a 7-day window", () => {
    const seen = new Set<string>();
    for (let day = 0; day < 7; day++) {
      seen.add(getJSearchRotationCountry(day));
    }
    expect(seen.size).toBe(JSEARCH_ROTATION_COUNTRIES.length);
    for (const c of JSEARCH_ROTATION_COUNTRIES) {
      expect(seen.has(c)).toBe(true);
    }
  });

  it("includes exactly one rotating international market per run", () => {
    for (let day = 0; day < 21; day++) {
      const rotationCountry = getJSearchRotationCountry(day);
      const countries = getJSearchPlanPairs(day).map((p) => p.country);
      // All non-IN pairs must belong to the single rotating market (multiple
      // core queries for that market are fine — the market itself is one).
      const international = new Set(
        countries.filter((c) => c !== JSEARCH_HOME_COUNTRY)
      );
      expect([...international]).toEqual([rotationCountry]);
    }
  });

  it("repeats the same rotation after 7 days", () => {
    expect(getJSearchRotationCountry(0)).toBe(getJSearchRotationCountry(7));
    expect(getJSearchRotationCountry(3)).toBe(getJSearchRotationCountry(10));
  });

  it("applies the core query set to the rotating market", () => {
    const day = 2;
    const rotationCountry = getJSearchRotationCountry(day);
    const rotatingPairs = getJSearchPlanPairs(day).filter(
      (p) => p.country === rotationCountry
    );
    expect(rotatingPairs.map((p) => p.query).sort()).toEqual(
      [...JSEARCH_CORE_QUERIES].sort()
    );
  });
});

describe("JSearch plan — student/early-career focus", () => {
  it("all core queries target internships, graduate or entry-level roles", () => {
    const joined = JSEARCH_CORE_QUERIES.join(" ").toLowerCase();
    for (const signal of ["intern", "graduate", "entry level"]) {
      expect(joined).toContain(signal);
    }
  });

  it("uses exactly the approved core query set", () => {
    expect(JSEARCH_CORE_QUERIES).toEqual([
      "Software Engineering Intern",
      "Software Developer Intern",
      "Machine Learning Intern",
      "Data Science Intern",
      "Graduate Software Engineer",
      "Entry Level Software Engineer",
    ]);
  });
});
