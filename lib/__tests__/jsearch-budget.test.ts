/**
 * JSearch request-budget tests.
 *
 * Verifies the adapter-level budget guard: the umbrella adapter must stop
 * before exceeding JSEARCH_MAX_REQUESTS_PER_RUN, dependent adapters must skip
 * cleanly when their whole grid no longer fits, and no provider fetch may
 * happen once the budget is exhausted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getJSearchRequestBudget,
  tryReserveJSearchRequests,
  getJSearchRequestsReserved,
  _resetJSearchBudget,
} from "@/lib/ingestion/jsearch-budget";
import { JSearchSource } from "@/lib/ingestion/sources/jsearch";
import { LinkedInSource } from "@/lib/ingestion/sources/linkedin";
import { _resetEndpointCache } from "@/lib/ingestion/jsearch-endpoint";

beforeEach(() => {
  _resetJSearchBudget();
  _resetEndpointCache();
  delete process.env.JSEARCH_MAX_REQUESTS_PER_RUN;
  delete process.env.JSEARCH_API_KEY;
  delete process.env.RAPIDAPI_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("budget module", () => {
  it("defaults to a conservative 16 requests per run", () => {
    expect(getJSearchRequestBudget()).toBe(16);
  });

  it("is configurable via JSEARCH_MAX_REQUESTS_PER_RUN", () => {
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "7";
    expect(getJSearchRequestBudget()).toBe(7);
  });

  it("ignores invalid configuration values and falls back to default", () => {
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "not-a-number";
    expect(getJSearchRequestBudget()).toBe(16);
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "-3";
    expect(getJSearchRequestBudget()).toBe(16);
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "0";
    expect(getJSearchRequestBudget()).toBe(16);
  });

  it("reserves only when the reservation fits the budget", () => {
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "5";
    expect(tryReserveJSearchRequests(3)).toBe(true);
    expect(tryReserveJSearchRequests(2)).toBe(true);
    expect(getJSearchRequestsReserved()).toBe(5);
    // Over budget → denied, nothing reserved.
    expect(tryReserveJSearchRequests(1)).toBe(false);
    expect(getJSearchRequestsReserved()).toBe(5);
  });
});

function stubOkFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("umbrella adapter budget enforcement", () => {
  it("never issues more provider requests than the configured budget", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "3";

    const fetchMock = stubOkFetch();
    const source = new JSearchSource();
    const results = await source.fetch();

    expect(results).toEqual([]);
    // Plan is ~18 requests; a budget of 3 must hard-stop at exactly 3.
    expect(fetchMock.mock.calls.length).toBe(3);
    expect(getJSearchRequestsReserved()).toBe(3);
  });

  it("stops before issuing any request when the budget is already exhausted", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "1";

    // Consume the whole budget before the adapter runs.
    expect(tryReserveJSearchRequests(1)).toBe(true);

    const fetchMock = stubOkFetch();
    const source = new JSearchSource();
    const results = await source.fetch();

    expect(results).toEqual([]);
    expect(fetchMock.mock.calls.length).toBe(0); // No provider requests at all
  });

  it("reserves a request even when the provider returns an error", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "4";

    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const source = new JSearchSource();
    // All requests fail → adapter must surface a summary error, not fetched: 0.
    await expect(source.fetch()).rejects.toThrow(/All 4 requests failed/);
    expect(fetchMock.mock.calls.length).toBe(4);
    expect(getJSearchRequestsReserved()).toBe(4);
  });

  it("returns successful jobs when only some requests fail (partial failure)", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "4";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              job_id: "job-1",
              job_title: "Software Engineering Intern",
              employer_name: "Acme",
              job_city: "Bengaluru",
              job_country: "India",
              job_is_remote: false,
              job_apply_link: "https://acme.example.com/apply",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const source = new JSearchSource();
    const results = await source.fetch();

    // Partial failure must NOT throw — the successful jobs come back.
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Software Engineering Intern");
    expect(fetchMock.mock.calls.length).toBe(4);
    expect(getJSearchRequestsReserved()).toBe(4);
  });
});

describe("dependent adapter budget enforcement", () => {
  it("skips its whole grid when the grid no longer fits the remaining budget", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    // LinkedIn's grid needs 15 requests; give it a budget of 10.
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "10";

    const fetchMock = stubOkFetch();
    const source = new LinkedInSource();
    const results = await source.fetch();

    expect(results).toEqual([]);
    expect(fetchMock.mock.calls.length).toBe(0); // skipped before any request
    expect(getJSearchRequestsReserved()).toBe(0); // nothing reserved on denial
  });

  it("runs its full grid when the budget is sufficient", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "20";

    const fetchMock = stubOkFetch();
    const source = new LinkedInSource();
    const results = await source.fetch();

    expect(results).toEqual([]);
    // LinkedIn has 15 queries in one market.
    expect(fetchMock.mock.calls.length).toBe(15);
    expect(getJSearchRequestsReserved()).toBe(15);
  });

  it("site-scoped adapters never run after the umbrella consumes the budget", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    process.env.JSEARCH_MAX_REQUESTS_PER_RUN = "20";

    const fetchMock = stubOkFetch();

    // Same process, same budget: umbrella first (14 planned, 16 budget).
    const umbrella = new JSearchSource();
    await umbrella.fetch();
    expect(getJSearchRequestsReserved()).toBe(14);

    // LinkedIn (needs 15 more) must be denied and issue zero requests.
    const linkedin = new LinkedInSource();
    const results = await linkedin.fetch();
    expect(results).toEqual([]);
    expect(fetchMock.mock.calls.length).toBe(14); // only the umbrella's calls
  });
});
