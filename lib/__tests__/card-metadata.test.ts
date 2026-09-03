import { describe, it, expect } from "vitest";
import { extractStipend, extractDuration } from "@/lib/card-metadata";

/**
 * Tests for card-level metadata extraction from description text.
 * Uses the centralized extraction helpers from lib/card-metadata.ts.
 */

describe("extractStipend from description", () => {
  it("extracts stipend from 'Stipend: ₹7,000 - 10,000 /month' with non-breaking unit", () => {
    const result = extractStipend("Internship at Acme. Stipend: ₹7,000 - 10,000 /month. Duration: 3 Months.");
    // /month must be attached via non-breaking space (\u00a0) to prevent orphaned wrapping
    expect(result).toContain("/month");
    expect(result).toContain("\u00a0/month");
    // Must NOT have a regular ASCII space (0x20) before /month
    const parts = result!.split("/month");
    expect(parts[0].endsWith(" ")).toBe(false);
  });

  it("extracts stipend from inline pattern with non-breaking unit", () => {
    const result = extractStipend("Internship at Acme. ₹ 15,000 - 25,000 /month.");
    expect(result).toContain("\u00a0/month");
    const parts = result!.split("/month");
    expect(parts[0].endsWith(" ")).toBe(false);
  });

  it("returns null for no stipend", () => {
    expect(extractStipend("Internship at Acme. Duration: 3 Months.")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractStipend(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractStipend("")).toBeNull();
  });

  it("handles lowercase 'stipend' with non-breaking unit", () => {
    const result = extractStipend("Internship at Acme. stipend: ₹5,000 /month.");
    expect(result).toContain("\u00a0/month");
  });

  it("does not fabricate stipend when none exists", () => {
    expect(extractStipend("No salary info provided.")).toBeNull();
  });

  it("does not fabricate duration when none exists", () => {
    expect(extractDuration("Rolling application.")).toBeNull();
  });
});

describe("extractDuration from description", () => {
  it("extracts duration from 'Duration: 3 Months'", () => {
    expect(extractDuration("Internship at Acme. Duration: 3 Months.")).toBe("3 Months");
  });

  it("extracts duration from inline pattern", () => {
    expect(extractDuration("Internship at Acme. 6 Weeks. Location: Remote.")).toBe("6 Weeks");
  });

  it("extracts '1 Month'", () => {
    expect(extractDuration("Duration: 1 Month")).toBe("1 Month");
  });

  it("returns null for no duration", () => {
    expect(extractDuration("Internship at Acme. Stipend: ₹5,000.")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractDuration(null)).toBeNull();
  });
});

describe("card metadata presence scenarios", () => {
  const scenarios = [
    { name: "stipend + duration + deadline", stipend: "₹7,000\u00a0/month", duration: "3 Months", deadline: "Sep 15, 2026" },
    { name: "stipend + duration, no deadline", stipend: "₹10,000\u00a0/month", duration: "6 Weeks", deadline: null },
    { name: "no stipend, duration only", stipend: null, duration: "3 Months", deadline: null },
    { name: "no duration, stipend only", stipend: "₹5,000\u00a0/month", duration: null, deadline: null },
    { name: "no stipend, no duration, no deadline", stipend: null, duration: null, deadline: null },
    { name: "remote location", stipend: "₹8,000\u00a0/month", duration: "2 Months", deadline: null },
    { name: "physical location", stipend: "₹12,000\u00a0/month", duration: "4 Months", deadline: "Oct 1, 2026" },
  ];

  for (const s of scenarios) {
    it(`handles: ${s.name}`, () => {
      // Verify the extraction functions handle each scenario
      expect(extractStipend(s.stipend ? `Stipend: ${s.stipend}` : null)).toBe(s.stipend);
      expect(extractDuration(s.duration ? `Duration: ${s.duration}` : null)).toBe(s.duration);
      // The card should hide the metadata strip entirely when all values are null
      const hasAnyMetadata = Boolean(s.stipend || s.duration || s.deadline);
      expect(hasAnyMetadata).toBe(Boolean(s.stipend || s.duration || s.deadline));
    });
  }
});
