import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import {
  extractStipendFromText,
  extractDurationFromText,
  extractStartDateFromText,
  extractWorkMode,
  normalizeEmploymentType,
} from "@/lib/backfill-metadata";

// ── Stipend extraction ──────────────────────────────────────────────────────

describe("extractStipendFromText", () => {
  it("extracts stipend from synthetic description format", () => {
    const desc = "Internship at Spadosphere. Stipend: ₹7,000 - 1,02,000 /month. Duration: 3 Months.";
    expect(extractStipendFromText(desc)).toBe("₹7,000 - 1,02,000 /month");
  });

  it("extracts stipend with currency symbol prefix", () => {
    const desc = "Internship at Corp. Stipend: ₹ 5,000 - 7,000 /month.";
    expect(extractStipendFromText(desc)).toBe("₹ 5,000 - 7,000 /month");
  });

  it("extracts single-value stipend", () => {
    const desc = "Stipend: ₹15,000 /month";
    expect(extractStipendFromText(desc)).toBe("₹15,000 /month");
  });

  it("extracts USD salary range", () => {
    const desc = "Salary: $80,000 - $120,000/year";
    expect(extractStipendFromText(desc)).toBe("$80,000 - $120,000/year");
  });

  it("detects Unpaid", () => {
    expect(extractStipendFromText("This is an unpaid internship")).toBe("Unpaid");
    expect(extractStipendFromText("Volunteer position")).toBe("Unpaid");
  });

  it("returns null when no stipend info", () => {
    expect(extractStipendFromText("Great opportunity at a startup")).toBeNull();
    expect(extractStipendFromText("")).toBeNull();
    expect(extractStipendFromText(null as any)).toBeNull();
  });

  it("preserves range format", () => {
    const desc = "Stipend: ₹7,000 - 1,02,000 /month";
    const result = extractStipendFromText(desc);
    expect(result).toContain("7,000");
    expect(result).toContain("1,02,000");
    expect(result).toContain("/");
  });

  it("does not break on complex descriptions", () => {
    const desc = "We are looking for an intern. The stipend is competitive. Duration 3 months.";
    // No explicit stipend amount, should return null
    expect(extractStipendFromText(desc)).toBeNull();
  });
});

// ── Duration extraction ─────────────────────────────────────────────────────

describe("extractDurationFromText", () => {
  it("extracts duration from synthetic description", () => {
    const desc = "Stipend: ₹7,000/month. Duration: 3 Months.";
    expect(extractDurationFromText(desc)).toBe("3 Months");
  });

  it("extracts duration with various capitalizations", () => {
    expect(extractDurationFromText("Duration: 6 Weeks")).toBe("6 Weeks");
    expect(extractDurationFromText("Duration: 1 Month")).toBe("1 Month");
    expect(extractDurationFromText("Duration: 12 months")).toBe("12 Months");
  });

  it("extracts standalone duration", () => {
    expect(extractDurationFromText("3 Months long internship")).toBe("3 Months");
  });

  it("detects Ongoing", () => {
    expect(extractDurationFromText("This is an ongoing position")).toBe("Ongoing");
    expect(extractDurationFromText("Rolling deadlines")).toBe("Ongoing");
  });

  it("returns null when no duration info", () => {
    expect(extractDurationFromText("Great opportunity")).toBeNull();
    expect(extractDurationFromText("")).toBeNull();
    expect(extractDurationFromText(null as any)).toBeNull();
  });
});

// ── Start date extraction ───────────────────────────────────────────────────

describe("extractStartDateFromText", () => {
  it("extracts Immediately", () => {
    expect(extractStartDateFromText("Start Date: Immediately")).toBe("Immediately");
    expect(extractStartDateFromText("Starting from Immediately")).toBe("Immediately");
  });

  it("extracts Within N days", () => {
    expect(extractStartDateFromText("Start Date: Within 7 days")).toBe("Within 7 days");
  });

  it("returns null when no start date", () => {
    expect(extractStartDateFromText("No start date info")).toBeNull();
    expect(extractStartDateFromText("")).toBeNull();
  });
});

// ── Work mode extraction ────────────────────────────────────────────────────

describe("extractWorkMode", () => {
  it("extracts Remote from 'Work from home'", () => {
    expect(extractWorkMode("Work from home")).toBe("Remote");
  });

  it("extracts Remote from 'Remote'", () => {
    expect(extractWorkMode("Remote")).toBe("Remote");
  });

  it("extracts Remote from 'WFH'", () => {
    expect(extractWorkMode("WFH")).toBe("Remote");
  });

  it("extracts Hybrid", () => {
    expect(extractWorkMode("Mumbai (Hybrid)")).toBe("Hybrid");
  });

  it("extracts On-site", () => {
    expect(extractWorkMode("San Francisco")).toBe("On-site");
    expect(extractWorkMode("Office")).toBe("On-site");
  });

  it("returns Unknown for empty input", () => {
    expect(extractWorkMode("")).toBe("Unknown");
  });
});

// ── Employment type normalization ────────────────────────────────────────────

describe("normalizeEmploymentType", () => {
  it("normalizes internship", () => {
    expect(normalizeEmploymentType("internship")).toBe("Internship");
    expect(normalizeEmploymentType("Internship")).toBe("Internship");
  });

  it("normalizes part-time", () => {
    expect(normalizeEmploymentType("part_time")).toBe("Part-time");
    expect(normalizeEmploymentType("part-time")).toBe("Part-time");
    expect(normalizeEmploymentType("part time")).toBe("Part-time");
  });

  it("normalizes full-time", () => {
    expect(normalizeEmploymentType("full_time")).toBe("Full-time");
    expect(normalizeEmploymentType("full-time")).toBe("Full-time");
  });

  it("normalizes contract", () => {
    expect(normalizeEmploymentType("contract")).toBe("Contract");
  });

  it("returns null for null/undefined", () => {
    expect(normalizeEmploymentType(null)).toBeNull();
    expect(normalizeEmploymentType(undefined)).toBeNull();
  });

  it("preserves unknown types", () => {
    expect(normalizeEmploymentType("freelance")).toBe("Freelance");
    expect(normalizeEmploymentType("Custom Type")).toBe("Custom Type");
  });
});

// ── Integration: full description parsing ────────────────────────────────────

describe("Full description parsing — synthetic Internshala format", () => {
  const syntheticDesc = "Internship at Spadosphere India Private Limited. Stipend: ₹7,000 - 1,02,000 /month. Duration: 3 Months. Location: Remote.";

  it("extracts stipend from full synthetic description", () => {
    const s = extractStipendFromText(syntheticDesc);
    expect(s).toBeTruthy();
    expect(s).toContain("7,000");
    expect(s).toContain("1,02,000");
  });

  it("extracts duration from full synthetic description", () => {
    const d = extractDurationFromText(syntheticDesc);
    expect(d).toBe("3 Months");
  });

  it("stipend range is preserved (not simplified)", () => {
    const s = extractStipendFromText(syntheticDesc);
    expect(s).toContain("-");
    // Must not be just a single number
    expect(s?.match(/\d+/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("no fabricated data when fields absent", () => {
    const desc = "Internship at BigCorp. Great team environment.";
    expect(extractStipendFromText(desc)).toBeNull();
    expect(extractDurationFromText(desc)).toBeNull();
    expect(extractStartDateFromText(desc)).toBeNull();
  });
});

// ── Source file structure ────────────────────────────────────────────────────

describe("Backfill script exists", () => {
  it("backfill-metadata.ts exists", () => {
    expect(existsSync("scripts/backfill-metadata.ts")).toBe(true);
  });

  it("backfill-metadata.ts imports extraction utilities", () => {
    const code = readFileSync("scripts/backfill-metadata.ts", "utf8");
    expect(code).toContain("extractStipendFromText");
    expect(code).toContain("extractDurationFromText");
  });
});
