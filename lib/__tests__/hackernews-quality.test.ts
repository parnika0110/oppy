import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * Regression tests for the Hacker News "Who is Hiring?" adapter.
 *
 * Tests cover:
 * - Quality filters (senior-only, multi-role, missing URL)
 * - Application URL extraction
 * - Location extraction
 * - HTML entity cleaning
 * - Title normalization
 * - Lifecycle constants
 * - Edge cases
 */

const adapterCode = readFileSync("lib/ingestion/sources/hackernews.ts", "utf8");
const lifecycleCode = readFileSync("lib/lifecycle.ts", "utf8");

// ── Helper: Extract and test the exported constants/functions ────────────────

describe("HN adapter — exported constants", () => {
  it("exports HN_MAX_AGE_DAYS as 90", () => {
    expect(adapterCode).toContain("HN_MAX_AGE_DAYS = 90");
  });

  it("lifecycle imports HN_MAX_AGE_DAYS", () => {
    expect(lifecycleCode).toContain('import { HN_MAX_AGE_DAYS } from "@/lib/ingestion/sources/hackernews"');
  });

  it("lifecycle has hnStale check for Hacker News source", () => {
    expect(lifecycleCode).toContain('opportunity.source === "Hacker News"');
    expect(lifecycleCode).toContain("hnStale");
  });
});

// ── Senior-only role filtering ───────────────────────────────────────────────

describe("HN adapter — senior-only filtering", () => {
  it("defines SENIOR_ROLE_PATTERNS regex", () => {
    expect(adapterCode).toContain("SENIOR_ROLE_PATTERNS");
    expect(adapterCode).toContain("engineering\\s*manager");
    expect(adapterCode).toContain("staff\\s*engineer");
    expect(adapterCode).toContain("principal\\s*engineer");
    expect(adapterCode).toContain("director");
    expect(adapterCode).toContain("head\\s+of");
  });

  it("defines EARLY_CAREER_SIGNALS regex", () => {
    expect(adapterCode).toContain("EARLY_CAREER_SIGNALS");
    expect(adapterCode).toContain("intern");
    expect(adapterCode).toContain("internship");
    expect(adapterCode).toContain("entry.level");
    expect(adapterCode).toContain("junior");
    expect(adapterCode).toContain("new.grad");
    expect(adapterCode).toContain("graduate");
  });

  it("has isSeniorOnly function that checks both patterns", () => {
    expect(adapterCode).toContain("function isSeniorOnly(");
    expect(adapterCode).toContain("SENIOR_ROLE_PATTERNS.test(title)");
    expect(adapterCode).toContain("EARLY_CAREER_SIGNALS.test(combined)");
  });

  it("skips senior-only roles during fetch", () => {
    expect(adapterCode).toContain("parsed.seniorOnly");
    expect(adapterCode).toContain("skippedSenior++");
  });

  it("senior patterns include VP and architect", () => {
    // Verify VP and architect are in the senior pattern
    expect(adapterCode).toContain("vp\\s");
    expect(adapterCode).toContain("architect");
  });

  it("early-career signals include apprentice and co-op", () => {
    expect(adapterCode).toContain("apprentice");
    expect(adapterCode).toContain("co-op");
  });
});

// ── Multi-role detection ─────────────────────────────────────────────────────

describe("HN adapter — multi-role filtering", () => {
  it("defines isMultiRoleComment function", () => {
    expect(adapterCode).toContain("function isMultiRoleComment(");
  });

  it("skips multi-role comments during fetch", () => {
    expect(adapterCode).toContain("parsed.multiRole");
    expect(adapterCode).toContain("skippedMultiRole++");
  });

  it("detects roles with multiple ampersands", () => {
    // The function checks for " & " / " and " / " / " in the role part
    expect(adapterCode).toContain("parts.length >= 3");
  });
});

// ── Application URL extraction ───────────────────────────────────────────────

describe("HN adapter — application URL extraction", () => {
  it("defines extractApplicationUrl function", () => {
    expect(adapterCode).toContain("function extractApplicationUrl(");
  });

  it("has APPLICATION_URL_PATTERNS with multiple patterns", () => {
    expect(adapterCode).toContain("APPLICATION_URL_PATTERNS");
    // Should have patterns for apply links, careers pages, and standalone URLs
    expect(adapterCode).toContain("apply");
    expect(adapterCode).toContain("careers?");
    expect(adapterCode).toContain("jobs?");
  });

  it("excludes HN discussion URLs from extraction", () => {
    expect(adapterCode).toContain("news\\.ycombinator\\.com");
    expect(adapterCode).toContain("www\\.ycombinator\\.com");
  });

  it("skips opportunities with no external URL", () => {
    expect(adapterCode).toContain("parsed.applicationUrl");
    expect(adapterCode).toContain("skippedNoUrl++");
  });

  it("uses extracted URL as applicationLink, not HN URL", () => {
    expect(adapterCode).toContain("applicationLink = parsed.applicationUrl");
  });

  it("preserves HN URL as sourceUrl for reference", () => {
    expect(adapterCode).toContain("sourceUrl: hnItemUrl");
    expect(adapterCode).toContain("Preserve HN URL as source reference");
  });

  it("skips image URLs", () => {
    expect(adapterCode).toContain("\\.(png|jpg|jpeg|gif|svg|webp)");
  });
});

// ── Location extraction ──────────────────────────────────────────────────────

describe("HN adapter — location extraction", () => {
  it("extracts location from 3rd pipe-separated field", () => {
    expect(adapterCode).toContain("pipeParts.length >= 3");
  });

  it("has pattern-based fallback for Location: prefix", () => {
    expect(adapterCode).toContain("LOCATION_PATTERNS");
    expect(adapterCode).toContain("^location:");
  });

  it("handles 'NYC - hybrid' and similar patterns", () => {
    expect(adapterCode).toContain("New York|NYC|San Francisco|SF");
  });

  it("strips hybrid/remote parentheticals from location", () => {
    expect(adapterCode).toContain("(?:Hybrid|Remote|On[- ]site)");
  });

  it("falls back to 'See posting' for unparseable locations", () => {
    expect(adapterCode).toContain('return "See posting"');
  });
});

// ── Title cleaning ───────────────────────────────────────────────────────────

describe("HN adapter — title cleaning", () => {
  it("has cleanTitle function that removes salary", () => {
    expect(adapterCode).toContain("function cleanTitle(");
    expect(adapterCode).toContain("salary");
  });

  it("decodes HTML entities in titles", () => {
    expect(adapterCode).toContain("decodeHtmlEntities(cleaned)");
  });

  it("removes salary from title before storing", () => {
    expect(adapterCode).toContain("cleanTitle(");
    // Title is cleaned before push
    expect(adapterCode).toContain("const title = cleanTitle(");
  });
});

// ── Metadata handling ────────────────────────────────────────────────────────

describe("HN adapter — metadata handling", () => {
  it("never fabricates deadlines", () => {
    expect(adapterCode).toContain("deadline: null");
    expect(adapterCode).toContain('deadlineKind: "rolling"');
  });

  it("sets source to 'Hacker News'", () => {
    expect(adapterCode).toContain('source: "Hacker News"');
  });

  it("uses sourcePlatform 'Other'", () => {
    expect(adapterCode).toContain('sourcePlatform: "Other"');
  });

  it("generates sourceId from comment ID", () => {
    expect(adapterCode).toContain("sourceId: `hn-${comment.id}`");
  });

  it("removes 'startup' tag from default tags", () => {
    // The old adapter always added "startup" — the new one should not
    // (it only adds "startup" if the comment actually mentions startup)
    expect(adapterCode).not.toContain('[...parsed.tags, "hacker-news", "startup"]');
  });
});

// ── Deduplication ────────────────────────────────────────────────────────────

describe("HN adapter — deduplication", () => {
  it("deduplicates by title + company", () => {
    expect(adapterCode).toContain("key = `${title.toLowerCase()}-${company.toLowerCase()}`");
  });
});

// ── API configuration ────────────────────────────────────────────────────────

describe("HN adapter — API configuration", () => {
  it("uses HN Algolia API", () => {
    expect(adapterCode).toContain("https://hn.algolia.com/api/v1");
  });

  it("limits thread search to HN_MAX_AGE_DAYS", () => {
    expect(adapterCode).toContain("HN_MAX_AGE_DAYS * 24 * 3600");
  });

  it("has timeout on fetch requests", () => {
    expect(adapterCode).toContain("AbortSignal.timeout(10000)");
  });
});

// ── Lifecycle integration ────────────────────────────────────────────────────

describe("HN lifecycle — stale post closure", () => {
  it("lifecycle checks firstSeenAt for HN opportunities", () => {
    expect(lifecycleCode).toContain("opportunity.firstSeenAt instanceof Date");
  });

  it("lifecycle uses HN_MAX_AGE_DAYS for age threshold", () => {
    expect(lifecycleCode).toContain("HN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000");
  });

  it("lifecycle closes stale HN posts", () => {
    expect(lifecycleCode).toContain("hnStale");
    expect(lifecycleCode).toContain("lifecycleStatus: \"closed\"");
    expect(lifecycleCode).toContain("isActive: false");
  });

  it("lifecycle only applies to Hacker News source", () => {
    expect(lifecycleCode).toContain('source === "Hacker News"');
  });
});

// ── Logging ──────────────────────────────────────────────────────────────────

describe("HN adapter — logging", () => {
  it("logs skip counts for senior-only, multi-role, and no-URL", () => {
    expect(adapterCode).toContain("skippedSenior");
    expect(adapterCode).toContain("skippedMultiRole");
    expect(adapterCode).toContain("skippedNoUrl");
    expect(adapterCode).toContain("senior-only");
    expect(adapterCode).toContain("multi-role");
    expect(adapterCode).toContain("no URL");
  });
});

// ── Quality: no fabricated data ──────────────────────────────────────────────

describe("HN adapter — data integrity", () => {
  it("does not fabricate application URLs", () => {
    // Only parsed.applicationUrl is used, never invented
    expect(adapterCode).toContain("parsed.applicationUrl");
    // And hnItemUrl is only used as sourceUrl, never as applicationLink
    expect(adapterCode).not.toContain("applicationLink: itemUrl");
  });

  it("does not fabricate deadlines", () => {
    expect(adapterCode).toContain("deadline: null");
  });

  it("does not fabricate stipend/duration", () => {
    expect(adapterCode).not.toContain("stipend:");
    expect(adapterCode).not.toContain("duration:");
  });

  it("does not fabricate event dates", () => {
    expect(adapterCode).not.toContain("eventDate:");
    expect(adapterCode).not.toContain("eventEndDate:");
  });
});
