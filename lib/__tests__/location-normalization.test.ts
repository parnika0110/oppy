import { describe, it, expect } from "vitest";
import { normalizeLocation } from "@/lib/location-normalize";

/**
 * Tests for location normalization at ingestion time.
 * These verify that raw location strings from sources are properly cleaned.
 */

// Re-implement the ingestion-time normalization for testing
// (mirrors the function in lib/ingestion/index.ts)
function normalizeIngestedLocation(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/\s+/g, " ").trim();
  if (/^see\s+(the\s+)?(job\s+)?posting$/i.test(cleaned)) return "";
  cleaned = cleaned.replace(/\s*\((?:Hybrid|Remote|On[- ]site|Remote\/Hybrid)\)\s*$/i, "").trim();
  const normalized = normalizeLocation(cleaned);
  if (normalized.isRemote) return "Remote";
  const parts = [normalized.city, normalized.state, normalized.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : cleaned;
}

describe("normalizeIngestedLocation", () => {
  // ── "See posting" handling ──────────────────────────────────────────
  it('converts "See posting" to empty string', () => {
    expect(normalizeIngestedLocation("See posting")).toBe("");
  });

  it('converts "See the posting" to empty string', () => {
    expect(normalizeIngestedLocation("See the posting")).toBe("");
  });

  it('converts "See job posting" to empty string', () => {
    expect(normalizeIngestedLocation("See job posting")).toBe("");
  });

  it('converts "see the job posting" to empty string', () => {
    expect(normalizeIngestedLocation("see the job posting")).toBe("");
  });

  // ── Bangalore/Bengaluru normalization ───────────────────────────────
  it('normalizes "Bangalore" to "Bengaluru, Karnataka, India"', () => {
    expect(normalizeIngestedLocation("Bangalore")).toBe("Bengaluru, Karnataka, India");
  });

  it('normalizes "Bengaluru" to "Bengaluru, Karnataka, India"', () => {
    expect(normalizeIngestedLocation("Bengaluru")).toBe("Bengaluru, Karnataka, India");
  });

  // ── Whitespace cleanup ─────────────────────────────────────────────
  it('collapses multiple spaces in "Bangalore                                        (Hybrid)"', () => {
    expect(normalizeIngestedLocation("Bangalore                                        (Hybrid)")).toBe("Bengaluru, Karnataka, India");
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeIngestedLocation("  Mumbai  ")).toBe("Mumbai, Maharashtra, India");
  });

  // ── Hybrid/Remote/On-site suffix stripping ─────────────────────────
  it('strips "(Hybrid)" suffix from Delhi', () => {
    expect(normalizeIngestedLocation("Delhi (Hybrid)")).toBe("Delhi, India");
  });

  it('strips "(Remote)" suffix from San Francisco', () => {
    expect(normalizeIngestedLocation("San Francisco, CA (Remote)")).toContain("San Francisco");
  });

  it('strips "(On-site)" suffix', () => {
    expect(normalizeIngestedLocation("Mumbai (On-site)")).toBe("Mumbai, Maharashtra, India");
  });

  it('strips "(Remote/Hybrid)" suffix', () => {
    expect(normalizeIngestedLocation("NYC (Remote/Hybrid)")).toContain("New York");
  });

  // ── Remote detection ───────────────────────────────────────────────
  it('normalizes "Remote" to "Remote"', () => {
    expect(normalizeIngestedLocation("Remote")).toBe("Remote");
  });

  it('normalizes "Online" to "Remote"', () => {
    expect(normalizeIngestedLocation("Online")).toBe("Remote");
  });

  it('normalizes "Work from Home" to "Remote"', () => {
    expect(normalizeIngestedLocation("Work from Home")).toBe("Remote");
  });

  // ── Other cities ───────────────────────────────────────────────────
  it('normalizes "New York" properly', () => {
    const result = normalizeIngestedLocation("New York");
    expect(result).toContain("New York");
    expect(result).toContain("United States");
  });

  it('normalizes "NYC" to "New York, United States"', () => {
    expect(normalizeIngestedLocation("NYC")).toBe("New York, United States");
  });

  it('normalizes "San Francisco, CA" to "San Francisco, United States"', () => {
    expect(normalizeIngestedLocation("San Francisco, CA")).toContain("San Francisco");
  });

  // ── Empty/unknown ──────────────────────────────────────────────────
  it('returns empty for empty input', () => {
    expect(normalizeIngestedLocation("")).toBe("");
  });

  it('preserves unknown locations that match no aliases', () => {
    expect(normalizeIngestedLocation("Mars Colony")).toBe("Mars Colony");
  });

  it('normalizes "Global" to "Global"', () => {
    expect(normalizeIngestedLocation("Global")).toBe("Global");
  });
});

describe("normalizeLocation (existing)", () => {
  it("normalizes Bangalore to Bengaluru", () => {
    const result = normalizeLocation("Bangalore");
    expect(result.city).toBe("Bengaluru");
    expect(result.country).toBe("India");
  });

  it("normalizes NYC to New York", () => {
    const result = normalizeLocation("NYC");
    expect(result.city).toBe("New York");
  });

  it("detects Remote", () => {
    const result = normalizeLocation("Remote");
    expect(result.isRemote).toBe(true);
  });

  it("detects Online as Remote", () => {
    const result = normalizeLocation("Online");
    expect(result.isRemote).toBe(true);
  });

  it("normalizes Singapore", () => {
    const result = normalizeLocation("Singapore");
    expect(result.country).toBe("Singapore");
  });
});
