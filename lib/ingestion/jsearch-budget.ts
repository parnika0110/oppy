/**
 * JSearch request budget guard.
 *
 * All five JSearch-dependent adapters (JSearch, LinkedIn, Indeed, Glassdoor,
 * Wellfound) share ONE paid provider subscription and therefore ONE request
 * quota (free tier: 200 requests/month). The budget below is a hard,
 * configurable cap on how many provider requests a single Lambda/process
 * invocation may issue. Adapters must call tryReserveJSearchRequests() before
 * every request and stop as soon as the reservation is denied — so a run can
 * never exceed the configured budget.
 *
 * Configuration:
 *   JSEARCH_MAX_REQUESTS_PER_RUN — max provider requests per process/run.
 *                                   Defaults to 16 (the ~14-request student
 *                                   plan + headroom; even a daily run stays
 *                                   well inside the 200/month free tier, and
 *                                   no monthly schedule assumption is
 *                                   hardcoded).
 *
 * The counter is intentionally process-scoped: a Lambda invocation is one
 * process, so "per run" == "per process". Within a full-pipeline run this
 * prevents the umbrella grid from being followed by site-scoped adapters that
 * would otherwise double-spend the same quota.
 *
 * Monthly quota protection is achieved OPERATIONALLY: conservative scheduling
 * (umbrella every 7 days, site-scoped every 30 days) plus this per-run cap. A
 * process-local counter cannot guard the monthly quota across separate Lambda
 * invocations, and no provider /usage call is made by the adapter.
 */

const DEFAULT_JSEARCH_REQUEST_BUDGET = 16;

let reserved = 0;

/** Read the configured per-run request budget from the environment. */
export function getJSearchRequestBudget(): number {
  const raw = process.env.JSEARCH_MAX_REQUESTS_PER_RUN;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_JSEARCH_REQUEST_BUDGET;
}

/**
 * Reserve `count` provider requests. Returns false (without reserving anything)
 * when the reservation would exceed the configured budget — the caller must
 * stop issuing requests in that case.
 */
export function tryReserveJSearchRequests(count: number): boolean {
  const budget = getJSearchRequestBudget();
  if (reserved + count > budget) return false;
  reserved += count;
  return true;
}

/** Number of provider requests reserved so far in this process. */
export function getJSearchRequestsReserved(): number {
  return reserved;
}

/** Test-only: reset the process-scoped reservation counter. */
export function _resetJSearchBudget(): void {
  reserved = 0;
}
