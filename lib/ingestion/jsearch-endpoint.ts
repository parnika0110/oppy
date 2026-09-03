/**
 * Shared JSearch endpoint configuration.
 *
 * The JSearch API migrated from RapidAPI (jsearch.p.rapidapi.com/search)
 * to OpenWeb Ninja (api.openwebninja.com/jsearch/search).
 *
 * Credential architecture:
 *   JSEARCH_API_KEY  → OpenWeb Ninja (preferred, new provider)
 *   RAPIDAPI_KEY     → RapidAPI legacy fallback only (do NOT use against OpenWeb Ninja)
 *
 * The five dependent adapters (JSearch, LinkedIn, Indeed, Glassdoor, Wellfound)
 * all call detectJSearchEndpoint() and use the returned URL + headers.
 */

export interface JSearchEndpoint {
  url: string;
  headers: Record<string, string>;
}

let cached: JSearchEndpoint | null = null;

/** Reset cached endpoint (for testing only). */
export function _resetEndpointCache(): void {
  cached = null;
}

const OPENWEB_NINJA_URL = "https://api.openwebninja.com/jsearch/search";
const RAPIDAPI_LEGACY_URL = "https://jsearch.p.rapidapi.com/search";

/**
 * Detect the working JSearch endpoint. Caches the result for the process lifetime.
 *
 * Priority:
 *   1. JSEARCH_API_KEY → OpenWeb Ninja (new provider, dedicated key)
 *   2. RAPIDAPI_KEY → RapidAPI legacy (old provider, may be deprecated)
 *   3. Neither → return null
 *
 * Returns null if no valid configuration exists.
 */
export async function detectJSearchEndpoint(): Promise<JSearchEndpoint | null> {
  if (cached) return cached;

  const dedicatedKey = process.env.JSEARCH_API_KEY;
  const legacyKey = process.env.RAPIDAPI_KEY;

  // ── Priority 1: Dedicated OpenWeb Ninja key ───────────────────────────
  if (dedicatedKey) {
    const endpoint: JSearchEndpoint = {
      url: OPENWEB_NINJA_URL,
      headers: { "x-api-key": dedicatedKey },
    };
    cached = endpoint;
    console.log("[JSearch] Using OpenWeb Ninja (JSEARCH_API_KEY configured)");
    return cached;
  }

  // ── Priority 2: Legacy RapidAPI key (test before using) ───────────────
  if (legacyKey) {
    console.warn(
      "[JSearch] RAPIDAPI_KEY found but JSEARCH_API_KEY is not set. " +
      "The old RapidAPI JSearch endpoint may be deprecated. " +
      "Set JSEARCH_API_KEY for https://www.openwebninja.com/api/jsearch"
    );

    // Test the legacy RapidAPI endpoint — it may still work for some accounts
    try {
      const testUrl = new URL(RAPIDAPI_LEGACY_URL);
      testUrl.searchParams.set("query", "test");
      testUrl.searchParams.set("num_pages", "1");

      const res = await fetch(testUrl.toString(), {
        headers: {
          "X-RapidAPI-Key": legacyKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const endpoint: JSearchEndpoint = {
          url: RAPIDAPI_LEGACY_URL,
          headers: {
            "X-RapidAPI-Key": legacyKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
        };
        cached = endpoint;
        console.log("[JSearch] Using RapidAPI legacy endpoint (fallback)");
        return cached;
      }
      console.warn(`[JSearch] RapidAPI legacy returned ${res.status} — not usable`);
    } catch {
      console.warn("[JSearch] RapidAPI legacy unreachable");
    }

    // Legacy key exists but doesn't work — do NOT silently fail across 5 adapters
    console.error(
      "[JSearch] RAPIDAPI_KEY is not valid for the current JSearch API. " +
      "Get a new key at https://www.openwebninja.com/api/jsearch and set JSEARCH_API_KEY."
    );
    return null;
  }

  // ── Priority 3: No credentials ────────────────────────────────────────
  console.warn(
    "[JSearch] Not configured — set JSEARCH_API_KEY (https://www.openwebninja.com/api/jsearch)"
  );
  return null;
}
