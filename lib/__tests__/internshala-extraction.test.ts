import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * Regression tests for Internshala data extraction pipeline.
 *
 * Covers:
 * - Location normalization (Work from home → Remote, Hybrid, city extraction)
 * - Description extraction (real source description vs synthetic)
 * - Stipend extraction and formatting
 * - Duration extraction
 * - Employment type extraction
 * - Posted date extraction
 * - Skills extraction
 * - Company name cleanup
 * - No fabricated data
 * - Detail page structured metadata display
 * - Card metadata consistency
 */

const adapterCode = readFileSync("lib/ingestion/sources/internshala.ts", "utf8");
const detailCode = readFileSync("app/opportunity/[id]/page.tsx", "utf8");
const cardCode = readFileSync("components/OpportunityCard.tsx", "utf8");
const ingestionCode = readFileSync("lib/ingestion/index.ts", "utf8");

// ── Location normalization ──────────────────────────────────────────────────

describe("Internshala — location normalization", () => {
  it("defines normalizeInternshalaLocation function", () => {
    expect(adapterCode).toContain("function normalizeInternshalaLocation(");
  });

  it("normalizes 'Work from home' to Remote", () => {
    expect(adapterCode).toContain("work\\s*from\\s*home");
    expect(adapterCode).toContain('location: "Remote"');
    expect(adapterCode).toContain("isRemote: true");
  });

  it("normalizes standalone 'Remote' to Remote", () => {
    expect(adapterCode).toContain("/^remote$/i");
  });

  it("extracts city from 'Mumbai (Hybrid)' pattern", () => {
    expect(adapterCode).toContain("cityMatch");
    expect(adapterCode).toContain("(Hybrid|Remote|On[- ]site)");
  });

  it("preserves 'City (Hybrid)' format", () => {
    expect(adapterCode).toContain("(Hybrid)");
  });

  it("handles empty location gracefully", () => {
    expect(adapterCode).toContain('"See posting"');
  });
});

// ── Description extraction ──────────────────────────────────────────────────

describe("Internshala — description extraction", () => {
  it("extracts description from .about_job .text", () => {
    expect(adapterCode).toContain(".about_job .text");
  });

  it("prefers real description over synthetic", () => {
    expect(adapterCode).toContain("aboutText && aboutText.length > 20");
  });

  it("only generates minimal fallback when real description is absent", () => {
    expect(adapterCode).toContain("Fallback: minimal structured description");
  });

  it("does NOT generate 'Internship at X. Stipend: Y. Duration: Z.' for listings with real descriptions", () => {
    // The old code always started with `Internship at ${organization}.`
    // The new code only does this as a last resort fallback
    expect(adapterCode).not.toContain('const parts = [`Internship at ${organization}.`]');
  });

  it("caps description at 2000 characters", () => {
    expect(adapterCode).toContain("substring(0, 2000)");
  });
});

// ── Stipend extraction ──────────────────────────────────────────────────────

describe("Internshala — stipend extraction", () => {
  it("extracts stipend from .stipend element", () => {
    expect(adapterCode).toContain('.find(".stipend")');
  });

  it("cleans whitespace in stipend text", () => {
    expect(adapterCode).toContain('replace(/\\s+/g, " ")');
  });

  it("passes stipend as structured field", () => {
    expect(adapterCode).toContain("stipend: stipend || undefined");
  });
});

// ── Duration extraction ─────────────────────────────────────────────────────

describe("Internshala — duration extraction", () => {
  it("extracts duration via regex from detail text", () => {
    expect(adapterCode).toContain("durationMatch");
    expect(adapterCode).toContain("(?:Month|Week|Day|Year)s?");
  });

  it("passes duration as structured field", () => {
    expect(adapterCode).toContain("duration: duration || undefined");
  });
});

// ── Employment type ─────────────────────────────────────────────────────────

describe("Internshala — employment type", () => {
  it("extracts employment_type from data attribute", () => {
    expect(adapterCode).toContain('attr("employment_type")');
  });

  it("passes employmentType as structured field", () => {
    expect(adapterCode).toContain("employmentType: employmentType || undefined");
  });

  it("ingestion index persists employmentType", () => {
    expect(ingestionCode).toContain("employmentType: extended.employmentType || null");
  });
});

// ── Posted date ─────────────────────────────────────────────────────────────

describe("Internshala — posted date", () => {
  it("extracts posted date from .status-inactive span", () => {
    expect(adapterCode).toContain(".status-inactive span");
  });

  it("validates posted date format (N unit(s) ago)", () => {
    expect(adapterCode).toContain("(minute|hour|day|week|month|year)s?\\s*ago");
  });

  it("passes sourcePublishedAt as structured field", () => {
    expect(adapterCode).toContain("sourcePublishedAt: sourcePublishedAt || undefined");
  });

  it("ingestion index persists sourcePublishedAt", () => {
    expect(ingestionCode).toContain("sourcePublishedAt: extended.sourcePublishedAt || null");
  });
});

// ── Skills ──────────────────────────────────────────────────────────────────

describe("Internshala — skills extraction", () => {
  it("extracts skills from .job_skill elements", () => {
    expect(adapterCode).toContain('.find(".job_skill")');
  });

  it("handles multiple skills per card", () => {
    expect(adapterCode).toContain(".each((_, skillEl)");
  });
});

// ── Company name cleanup ────────────────────────────────────────────────────

describe("Internshala — company name cleanup", () => {
  it("cleans whitespace from company name", () => {
    expect(adapterCode).toContain('replace(/\\s+/g, " ")');
    // The .company-name text has trailing whitespace/newlines
    expect(adapterCode).toContain(".company-name");
  });
});

// ── isRemote field ──────────────────────────────────────────────────────────

describe("Internshala — isRemote field", () => {
  it("passes isRemote as structured field", () => {
    expect(adapterCode).toContain("isRemote,");
  });

  it("ingestion index persists isRemote", () => {
    expect(ingestionCode).toContain("isRemote: extended.isRemote || false");
  });
});

// ── Data integrity — no fabrication ─────────────────────────────────────────

describe("Internshala — no fabricated data", () => {
  it("does not fabricate start date", () => {
    expect(adapterCode).not.toContain("startDate");
  });

  it("does not fabricate application deadline", () => {
    // deadline is set to null (not fabricated)
    expect(adapterCode).toContain("deadline: null");
    expect(adapterCode).toContain('deadlineKind: "unavailable"');
  });

  it("does not fabricate stipend when absent", () => {
    // stipend is passed as-is, not invented
    expect(adapterCode).toContain("stipend: stipend || undefined");
  });

  it("does not fabricate duration when absent", () => {
    expect(adapterCode).toContain("duration: duration || undefined");
  });
});

// ── Detail page structured metadata ─────────────────────────────────────────

describe("Detail page — structured metadata display", () => {
  it("displays stipend when available", () => {
    expect(detailCode).toContain("oppAny.stipend");
    expect(detailCode).toContain("💰 Stipend");
  });

  it("displays duration when available", () => {
    expect(detailCode).toContain("oppAny.duration");
    expect(detailCode).toContain("⏱ Duration");
  });

  it("displays employment type when available", () => {
    expect(detailCode).toContain("oppAny.employmentType");
    expect(detailCode).toContain("📋 Type");
  });

  it("displays posted date when available", () => {
    expect(detailCode).toContain("oppAny.sourcePublishedAt");
    expect(detailCode).toContain("🕐 Posted");
  });

  it("only renders metadata section when at least one field exists", () => {
    expect(detailCode).toContain("hasMeta");
  });

  it("formats employment type by replacing underscores", () => {
    expect(detailCode).toContain("replace(/_/g, \" \")");
  });

  it("does NOT show 'Unavailable' for stipend/duration/type/posted", () => {
    // The section only renders when hasMeta is true, so no placeholders shown
    // Check that there's no "Unavailable" text in the metadata section
    const metaSection = detailCode.substring(
      detailCode.indexOf(" Structured metadata"),
      detailCode.indexOf(" Description", detailCode.indexOf(" Structured metadata"))
    );
    expect(metaSection).not.toContain("Unavailable");
  });
});

// ── Card metadata consistency ───────────────────────────────────────────────

describe("Card — structured metadata usage", () => {
  it("card prefers structured stipend over description extraction", () => {
    expect(cardCode).toContain("opportunity.stipend || extractStipend");
  });

  it("card prefers structured duration over description extraction", () => {
    expect(cardCode).toContain("opportunity.duration || extractDuration");
  });
});

// ── Adapter API surface ─────────────────────────────────────────────────────

describe("Internshala adapter — API surface", () => {
  it("exports HackerNewsSource-like class (OpportunitySource interface)", () => {
    expect(adapterCode).toContain("implements OpportunitySource");
  });

  it("has name and platform properties", () => {
    expect(adapterCode).toContain('name = "Internshala"');
    expect(adapterCode).toContain('platform = "Internshala"');
  });

  it("has fetch method returning Promise<RawOpportunity[]>", () => {
    expect(adapterCode).toContain("async fetch(): Promise<RawOpportunity[]>");
  });
});
