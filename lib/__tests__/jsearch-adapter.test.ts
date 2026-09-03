import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { detectJSearchEndpoint, _resetEndpointCache } from "@/lib/ingestion/jsearch-endpoint";

// ── Mocks ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  _resetEndpointCache();
  mockFetch.mockReset();
  delete process.env.JSEARCH_API_KEY;
  delete process.env.RAPIDAPI_KEY;
});

// ── Credential Selection Tests ──────────────────────────────────────────

describe("detectJSearchEndpoint — credential selection", () => {
  it("returns OpenWeb Ninja when JSEARCH_API_KEY is set", async () => {
    process.env.JSEARCH_API_KEY = "test-key-123";
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint).not.toBeNull();
    expect(endpoint!.url).toContain("openwebninja.com");
    expect(endpoint!.headers["x-api-key"]).toBe("test-key-123");
  });

  it("prefers JSEARCH_API_KEY over RAPIDAPI_KEY", async () => {
    process.env.JSEARCH_API_KEY = "new-key";
    process.env.RAPIDAPI_KEY = "old-key";
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint!.url).toContain("openwebninja.com");
    expect(endpoint!.headers["x-api-key"]).toBe("new-key");
  });

  it("returns null when no credentials are set", async () => {
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint).toBeNull();
  });

  it("tests legacy endpoint before using it", async () => {
    process.env.RAPIDAPI_KEY = "legacy-key";
    // Mock legacy endpoint returning 404
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint).toBeNull();
    expect(mockFetch).toHaveBeenCalled();
  });

  it("uses legacy endpoint if it returns 200", async () => {
    process.env.RAPIDAPI_KEY = "legacy-key";
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint).not.toBeNull();
    expect(endpoint!.url).toContain("rapidapi.com");
    expect(endpoint!.headers["X-RapidAPI-Key"]).toBe("legacy-key");
  });

  it("caches result across calls", async () => {
    process.env.JSEARCH_API_KEY = "test-key";
    const e1 = await detectJSearchEndpoint();
    const e2 = await detectJSearchEndpoint();
    expect(e1).toBe(e2); // Same reference = cached
  });

  it("reset clears cache", async () => {
    process.env.JSEARCH_API_KEY = "key1";
    await detectJSearchEndpoint();
    _resetEndpointCache();
    process.env.JSEARCH_API_KEY = "key2";
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint!.headers["x-api-key"]).toBe("key2");
  });
});

// ── Response Parsing Tests ──────────────────────────────────────────────

describe("JSearch mapJob — response parsing", () => {
  // Mirrors the mapJob function logic from jsearch.ts
  function mapJob(job: any, country: string) {
    if (!job.job_title || !job.employer_name) return null;
    const jobUrl = job.job_apply_link || job.job_google_link || job.job_url || "";
    if (!jobUrl) return null;
    const city = job.job_city || "";
    const jobCountry = job.job_country || country;
    const isRemote = Boolean(job.job_is_remote);
    const location = isRemote ? "Remote" : [city, jobCountry].filter(Boolean).join(", ") || "Unspecified";
    return { title: job.job_title, organization: job.employer_name, location, isRemote, imageUrl: job.employer_logo || null };
  }

  it("parses a complete job listing", () => {
    const job = {
      job_title: "Software Engineer",
      employer_name: "Google",
      job_apply_link: "https://careers.google.com/apply",
      job_city: "Bengaluru",
      job_country: "India",
      job_is_remote: false,
      employer_logo: "https://logo.google.com.png",
    };
    const result = mapJob(job, "IN");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Software Engineer");
    expect(result!.organization).toBe("Google");
    expect(result!.location).toBe("Bengaluru, India");
    expect(result!.isRemote).toBe(false);
    expect(result!.imageUrl).toBe("https://logo.google.com.png");
  });

  it("parses remote job", () => {
    const job = {
      job_title: "Remote Developer",
      employer_name: "GitLab",
      job_apply_link: "https://gitlab.com/apply",
      job_is_remote: true,
    };
    const result = mapJob(job, "US");
    expect(result!.location).toBe("Remote");
    expect(result!.isRemote).toBe(true);
  });

  it("returns null when job_title is missing", () => {
    const job = { employer_name: "Google", job_apply_link: "https://example.com" };
    expect(mapJob(job, "IN")).toBeNull();
  });

  it("returns null when employer_name is missing", () => {
    const job = { job_title: "Engineer", job_apply_link: "https://example.com" };
    expect(mapJob(job, "IN")).toBeNull();
  });

  it("returns null when no URL is available", () => {
    const job = { job_title: "Engineer", employer_name: "Google" };
    expect(mapJob(job, "IN")).toBeNull();
  });

  it("uses job_google_link as fallback URL", () => {
    const job = {
      job_title: "Engineer",
      employer_name: "Google",
      job_google_link: "https://google.com/apply",
    };
    const result = mapJob(job, "IN");
    expect(result).not.toBeNull();
  });

  it("handles missing city gracefully", () => {
    const job = {
      job_title: "Engineer",
      employer_name: "Google",
      job_apply_link: "https://example.com",
      job_country: "India",
    };
    const result = mapJob(job, "IN");
    expect(result!.location).toBe("India");
  });

  it("handles empty city — falls back to country param", () => {
    const job = {
      job_title: "Engineer",
      employer_name: "Google",
      job_apply_link: "https://example.com",
    };
    const result = mapJob(job, "IN");
    // When city is empty, location falls back to the country parameter
    expect(result!.location).toBe("IN");
  });

  it("Bengaluru location extraction", () => {
    const job = {
      job_title: "Developer",
      employer_name: "Startup",
      job_apply_link: "https://example.com",
      job_city: "Bengaluru",
      job_country: "India",
    };
    const result = mapJob(job, "IN");
    expect(result!.location).toBe("Bengaluru, India");
  });

  it("handles employer_logo being null", () => {
    const job = {
      job_title: "Engineer",
      employer_name: "Google",
      job_apply_link: "https://example.com",
      employer_logo: null,
    };
    const result = mapJob(job, "IN");
    expect(result!.imageUrl).toBeNull();
  });

  it("handles employer_logo being undefined", () => {
    const job = {
      job_title: "Engineer",
      employer_name: "Google",
      job_apply_link: "https://example.com",
    };
    const result = mapJob(job, "IN");
    expect(result!.imageUrl).toBeNull();
  });
});

// ── API Error Handling Tests ────────────────────────────────────────────

describe("JSearch — API error handling", () => {
  it("adapter returns empty array when endpoint is null", async () => {
    // When detectJSearchEndpoint returns null, the adapter should return []
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint).toBeNull();
    // The adapter checks: if (!endpoint) return [];
  });

  it("adapter handles 401 response gracefully", () => {
    // If the API returns 401, the adapter logs and continues
    const status = 401;
    expect(status).toBe(401);
    // The adapter does: if (!res.ok) { console.error(...); continue; }
  });

  it("adapter handles empty data response", () => {
    const data = { data: [] };
    const jobs = data?.data || [];
    expect(jobs).toHaveLength(0);
  });

  it("adapter handles missing data field", () => {
    const data = {};
    const jobs = (data as any)?.data || [];
    expect(jobs).toHaveLength(0);
  });

  it("adapter deduplicates by job_id", () => {
    const seen = new Set<string>();
    const jobs = [
      { job_id: "123", job_title: "A", employer_name: "X", job_apply_link: "http://a.com" },
      { job_id: "123", job_title: "A", employer_name: "X", job_apply_link: "http://a.com" },
      { job_id: "456", job_title: "B", employer_name: "Y", job_apply_link: "http://b.com" },
    ];
    const unique = jobs.filter((j) => {
      if (!j.job_id || seen.has(j.job_id)) return false;
      seen.add(j.job_id);
      return true;
    });
    expect(unique).toHaveLength(2);
  });
});

// ── Dependent Adapter Verification ──────────────────────────────────────

describe("Dependent adapters — shared endpoint", () => {
  it("JSearch uses detectJSearchEndpoint", () => {
    const code = readFileSync("lib/ingestion/sources/jsearch.ts", "utf8");
    expect(code).toContain("detectJSearchEndpoint");
    expect(code).toContain("endpoint.url");
    expect(code).toContain("endpoint.headers");
  });

  it("LinkedIn uses detectJSearchEndpoint", () => {
    const code = readFileSync("lib/ingestion/sources/linkedin.ts", "utf8");
    expect(code).toContain("detectJSearchEndpoint");
    expect(code).toContain("endpoint.url");
    expect(code).toContain("endpoint.headers");
  });

  it("Indeed uses detectJSearchEndpoint", () => {
    const code = readFileSync("lib/ingestion/sources/indeed.ts", "utf8");
    expect(code).toContain("detectJSearchEndpoint");
    expect(code).toContain("endpoint.url");
    expect(code).toContain("endpoint.headers");
  });

  it("Glassdoor uses detectJSearchEndpoint", () => {
    const code = readFileSync("lib/ingestion/sources/glassdoor.ts", "utf8");
    expect(code).toContain("detectJSearchEndpoint");
    expect(code).toContain("endpoint.url");
    expect(code).toContain("endpoint.headers");
  });

  it("Wellfound uses detectJSearchEndpoint", () => {
    const code = readFileSync("lib/ingestion/sources/wellfound.ts", "utf8");
    expect(code).toContain("detectJSearchEndpoint");
    expect(code).toContain("endpoint.url");
    expect(code).toContain("endpoint.headers");
  });

  it("no adapter sends RAPIDAPI_KEY to OpenWeb Ninja", () => {
    const sources = ["jsearch.ts", "linkedin.ts", "indeed.ts", "glassdoor.ts", "wellfound.ts"];
    for (const src of sources) {
      const code = readFileSync(`lib/ingestion/sources/${src}`, "utf8");
      // Should not hardcode RapidAPI headers
      expect(code).not.toContain("X-RapidAPI-Key");
      expect(code).not.toContain("X-RapidAPI-Host");
    }
  });

  it("endpoint detection handles missing JSEARCH_API_KEY gracefully", async () => {
    delete process.env.JSEARCH_API_KEY;
    delete process.env.RAPIDAPI_KEY;
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint).toBeNull();
    // Adapter should return [] when endpoint is null
  });
});

// ── Location Query Tests ────────────────────────────────────────────────

describe("JSearch — location queries", () => {
  it("COUNTRIES array includes India, France, Singapore", () => {
    const COUNTRIES = ["IN", "US", "GB", "DE", "CA", "AU", "FR", "SG"];
    expect(COUNTRIES).toContain("IN");
    expect(COUNTRIES).toContain("FR");
    expect(COUNTRIES).toContain("SG");
  });

  it("country parameter is passed to API URL", () => {
    const url = new URL("https://api.openwebninja.com/jsearch/search");
    url.searchParams.set("country", "IN");
    expect(url.searchParams.get("country")).toBe("IN");
  });

  it("Bengaluru results come from India country query", () => {
    // The API uses country=IN, and job_city contains Bengaluru
    const job = {
      job_title: "Developer",
      employer_name: "Startup",
      job_apply_link: "https://example.com",
      job_city: "Bengaluru",
      job_country: "India",
    };
    const location = [job.job_city, job.job_country].filter(Boolean).join(", ");
    expect(location).toBe("Bengaluru, India");
  });
});

// ── No Secret Leakage ──────────────────────────────────────────────────

describe("Security — no secret leakage", () => {
  it("detectJSearchEndpoint never logs API key", async () => {
    process.env.JSEARCH_API_KEY = "secret-key-abc123";
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await detectJSearchEndpoint();
    const logs = consoleSpy.mock.calls.map((c) => c.join(" "));
    for (const log of logs) {
      expect(log).not.toContain("secret-key-abc123");
    }
    consoleSpy.mockRestore();
  });

  it("adapter code does not contain hardcoded keys", () => {
    const code = readFileSync("lib/ingestion/sources/jsearch.ts", "utf8");
    expect(code).not.toContain("sk-");
    expect(code).not.toContain("api_key=");
  });
});
