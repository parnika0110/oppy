import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectJSearchEndpoint, _resetEndpointCache } from "@/lib/ingestion/jsearch-endpoint";

/**
 * Tests for JSearch endpoint selection.
 *
 * Credential architecture:
 *   JSEARCH_API_KEY → OpenWeb Ninja (preferred)
 *   RAPIDAPI_KEY → RapidAPI legacy fallback only
 */

describe("detectJSearchEndpoint", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all JSearch-related env vars
    delete process.env.JSEARCH_API_KEY;
    delete process.env.RAPIDAPI_KEY;
    // Reset module-level cache
    _resetEndpointCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null when no credentials are configured", async () => {
    const endpoint = await detectJSearchEndpoint();
    expect(endpoint).toBeNull();
  });

  it("uses OpenWeb Ninja when JSEARCH_API_KEY is set", async () => {
    process.env.JSEARCH_API_KEY = "test-openweb-key";
    const endpoint = await detectJSearchEndpoint();

    expect(endpoint).not.toBeNull();
    expect(endpoint!.url).toBe("https://api.openwebninja.com/jsearch/search");
    expect(endpoint!.headers["x-api-key"]).toBe("test-openweb-key");
    // Should NOT have RapidAPI headers
    expect(endpoint!.headers["X-RapidAPI-Key"]).toBeUndefined();
    expect(endpoint!.headers["X-RapidAPI-Host"]).toBeUndefined();
  });

  it("prefers JSEARCH_API_KEY over RAPIDAPI_KEY", async () => {
    process.env.JSEARCH_API_KEY = "dedicated-key";
    process.env.RAPIDAPI_KEY = "legacy-key";
    const endpoint = await detectJSearchEndpoint();

    expect(endpoint).not.toBeNull();
    expect(endpoint!.url).toBe("https://api.openwebninja.com/jsearch/search");
    expect(endpoint!.headers["x-api-key"]).toBe("dedicated-key");
    // Legacy key should NOT be used
    expect(endpoint!.headers["X-RapidAPI-Key"]).toBeUndefined();
  });

  it("returns null when only RAPIDAPI_KEY exists and legacy endpoint is unreachable", async () => {
    process.env.RAPIDAPI_KEY = "legacy-only-key";

    // Mock fetch to simulate 404 (endpoint retired)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as any;

    try {
      const endpoint = await detectJSearchEndpoint();
      expect(endpoint).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses RapidAPI legacy when only RAPIDAPI_KEY exists and endpoint works", async () => {
    process.env.RAPIDAPI_KEY = "working-legacy-key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as any;

    try {
      const endpoint = await detectJSearchEndpoint();
      expect(endpoint).not.toBeNull();
      expect(endpoint!.url).toBe("https://jsearch.p.rapidapi.com/search");
      expect(endpoint!.headers["X-RapidAPI-Key"]).toBe("working-legacy-key");
      expect(endpoint!.headers["X-RapidAPI-Host"]).toBe("jsearch.p.rapidapi.com");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns null when RAPIDAPI_KEY fetch throws", async () => {
    process.env.RAPIDAPI_KEY = "network-error-key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    try {
      const endpoint = await detectJSearchEndpoint();
      expect(endpoint).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("never exposes secret values in logs", async () => {
    process.env.JSEARCH_API_KEY = "secret-api-key-12345";
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await detectJSearchEndpoint();
      // Check that log messages don't contain the key
      for (const call of consoleSpy.mock.calls) {
        const msg = call.join(" ");
        expect(msg).not.toContain("secret-api-key-12345");
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("caches result across multiple calls", async () => {
    process.env.JSEARCH_API_KEY = "cached-key";

    const ep1 = await detectJSearchEndpoint();
    const ep2 = await detectJSearchEndpoint();

    expect(ep1).toBe(ep2); // Same reference = cached
  });
});
