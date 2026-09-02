/**
 * Shared JSearch endpoint auto-detection.
 *
 * The JSearch API migrated from RapidAPI (jsearch.p.rapidapi.com/search)
 * to OpenWeb Ninja (api.openwebninja.com/jsearch/search).
 * This module auto-detects which endpoint works and returns the correct
 * URL and auth headers.
 */

const CANDIDATE_ENDPOINTS = [
  "https://api.openwebninja.com/jsearch/search",
  "https://jsearch.p.rapidapi.com/search",
];

export interface JSearchEndpoint {
  url: string;
  headers: Record<string, string>;
}

let cached: JSearchEndpoint | null = null;

/**
 * Detect the working JSearch endpoint. Caches the result for the process lifetime.
 * Returns null if no endpoint works.
 */
export async function detectJSearchEndpoint(): Promise<JSearchEndpoint | null> {
  if (cached) return cached;

  const apiKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;
  if (!apiKey) return null;

  for (const candidate of CANDIDATE_ENDPOINTS) {
    try {
      const testUrl = new URL(candidate);
      testUrl.searchParams.set("query", "test");
      testUrl.searchParams.set("num_pages", "1");

      const headers: Record<string, string> = {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      };
      if (candidate.includes("openwebninja")) {
        headers["x-api-key"] = apiKey;
      }

      const res = await fetch(testUrl.toString(), {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        cached = { url: candidate, headers };
        console.log(`[JSearch] Using endpoint: ${candidate}`);
        return cached;
      }
      console.warn(`[JSearch] Endpoint ${candidate} returned ${res.status}`);
    } catch {
      console.warn(`[JSearch] Endpoint ${candidate} unreachable`);
    }
  }

  console.error(
    "[JSearch] No working endpoint found. The JSearch API may have migrated. " +
    "Visit https://www.openwebninja.com/api/jsearch to get a new API key."
  );
  return null;
}
