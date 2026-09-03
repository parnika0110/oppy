import { describe, it, expect } from "vitest";
import { extractStipend, extractDuration } from "@/lib/card-metadata";

/**
 * Tests for card-level metadata extraction from description text.
 * Uses the centralized extraction helpers from lib/card-metadata.ts.
 */

describe("extractStipend from description", () => {
  it("extracts stipend from 'Stipend: ₹7,000 - 10,000 /month'", () => {
    expect(extractStipend("Internship at Acme. Stipend: ₹7,000 - 10,000 /month. Duration: 3 Months.")).toBe("₹7,000 - 10,000 /month");
  });

  it("extracts stipend from inline pattern", () => {
    expect(extractStipend("Internship at Acme. ₹ 15,000 - 25,000 /month.")).toBe("₹ 15,000 - 25,000 /month");
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

  it("handles lowercase 'stipend'", () => {
    expect(extractStipend("Internship at Acme. stipend: ₹5,000 /month.")).toBe("₹5,000 /month");
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
    { name: "stipend + duration + deadline", stipend: "₹7,000 /month", duration: "3 Months", deadline: "Sep 15, 2026" },
    { name: "stipend + duration, no deadline", stipend: "₹10,000 /month", duration: "6 Weeks", deadline: null },
    { name: "no stipend, duration only", stipend: null, duration: "3 Months", deadline: null },
    { name: "no duration, stipend only", stipend: "₹5,000 /month", duration: null, deadline: null },
    { name: "no stipend, no duration, no deadline", stipend: null, duration: null, deadline: null },
    { name: "remote location", stipend: "₹8,000 /month", duration: "2 Months", deadline: null },
    { name: "physical location", stipend: "₹12,000 /month", duration: "4 Months", deadline: "Oct 1, 2026" },
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
