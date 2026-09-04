/**
 * JSearch query & country plan.
 *
 * The old strategy fired 11 generic queries x 8 countries = 88 requests per
 * run. That burned the free-tier quota (200/month) in ~2 runs and returned a
 * US-aggregator-heavy, senior-role-heavy feed (only 2 of 294 stored jobs were
 * Bengaluru-located).
 *
 * New strategy — small, student-focused, India-first, rotating:
 *   - Core queries target internships, graduate and entry-level engineering /
 *     AI / data / product / QA roles (early-career focus).
 *   - India (IN) is always queried; India-only anchor queries bias results
 *     toward Bengaluru and remote roles.
 *   - One additional international country rotates per run (US, GB, DE, CA,
 *     AU, FR, SG) so international coverage is retained without a full grid.
 *
 * Request math: 6 core x (IN + 1 rotating) + 2 India anchors = 14 requests per
 * cycle (~10-20 target), down from 88. Default JSEARCH_MAX_REQUESTS_PER_RUN is
 * 16, so a normal cycle completes with headroom for two extra requests.
 */

export const JSEARCH_HOME_COUNTRY = "IN";

/** Rotating international markets (one per run, cycled by UTC day). */
export const JSEARCH_ROTATION_COUNTRIES: readonly string[] = [
  "US", "GB", "DE", "CA", "AU", "FR", "SG",
];

/** Core student/early-career queries — applied to every country in the plan. */
export const JSEARCH_CORE_QUERIES: readonly string[] = [
  "Software Engineering Intern",
  "Software Developer Intern",
  "Machine Learning Intern",
  "Data Science Intern",
  "Graduate Software Engineer",
  "Entry Level Software Engineer",
];

/**
 * India-only anchor queries. JSearch has no city parameter, so city/remote
 * intent is expressed in the query text. These bias the IN results toward
 * Bengaluru and remote roles without polluting other markets.
 */
export const JSEARCH_INDIA_ANCHOR_QUERIES: readonly string[] = [
  "Software Engineering Intern Bengaluru",
  "internship Bengaluru remote",
];

/** Expected request count for one cycle given the current plan constants. */
export const JSEARCH_PLAN_REQUEST_COUNT =
  JSEARCH_CORE_QUERIES.length * 2 +
  JSEARCH_INDIA_ANCHOR_QUERIES.length;

export interface JSearchQueryPair {
  country: string;
  query: string;
}

/**
 * Pick the rotating country for a given UTC day offset (0 = today).
 * Deterministic and pure, so tests can iterate every market in the rotation.
 */
export function getJSearchRotationCountry(utcDayOffset: number): string {
  const idx = ((Math.floor(utcDayOffset) % JSEARCH_ROTATION_COUNTRIES.length) +
    JSEARCH_ROTATION_COUNTRIES.length) %
    JSEARCH_ROTATION_COUNTRIES.length;
  return JSEARCH_ROTATION_COUNTRIES[idx];
}

/**
 * Build the ordered list of (country, query) pairs for one ingestion cycle.
 * India first (core queries, then Bengaluru/remote anchors), followed by the
 * rotating international market's core queries.
 */
export function getJSearchPlanPairs(utcDayOffset: number): JSearchQueryPair[] {
  const pairs: JSearchQueryPair[] = [];

  for (const query of JSEARCH_CORE_QUERIES) {
    pairs.push({ country: JSEARCH_HOME_COUNTRY, query });
  }
  for (const query of JSEARCH_INDIA_ANCHOR_QUERIES) {
    pairs.push({ country: JSEARCH_HOME_COUNTRY, query });
  }

  const rotationCountry = getJSearchRotationCountry(utcDayOffset);
  for (const query of JSEARCH_CORE_QUERIES) {
    pairs.push({ country: rotationCountry, query });
  }

  return pairs;
}

/** Build the plan for the current UTC day (used by the adapter at runtime). */
export function getJSearchPlanPairsForToday(now: Date = new Date()): JSearchQueryPair[] {
  const utcDay = Math.floor(now.getTime() / 86_400_000);
  return getJSearchPlanPairs(utcDay);
}
