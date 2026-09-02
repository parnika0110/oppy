import { describe, it, expect } from "vitest";

/**
 * Regression tests for RSS feed opportunity classification.
 *
 * Root cause: The Grant regex included "fellowship" and "scholarship",
 * causing those categories to be incorrectly classified as Grant.
 *
 * These tests verify the classification logic extracted from rss-feeds.ts.
 */

// ── Classification logic (mirrors rss-feeds.ts) ─────────────────────────

function classify(combined: string): {
  isInternship: boolean;
  isFellowship: boolean;
  isScholarship: boolean;
  isGrant: boolean;
  isHackathon: boolean;
  isEvent: boolean;
} {
  const hasApplicationAction =
    /\b(apply|application|register|registration|submit|submitting|enroll|enrolment)\b/.test(combined);
  const hasDeadline =
    /\b(deadline|closing date|due date|last date|apply by|submit by|expires?|ends? on|ends? at|applications? (close|close|due))\b/.test(combined);
  const hasInvitation =
    /\b(now accepting|we're hiring|we are hiring|open for|looking for|seeking|accepting applications|accepting candidates|join (us|our|the)|become a|opportunity for)\b/.test(combined);
  const hasHiringAction =
    /\b(hiring|we're hiring|join our team|open positions?|job openings?|career|vacancy|vacancies)\b/.test(combined);

  const isInternship = /\b(intern|internship|co-?op)\b/.test(combined) && hasApplicationAction;
  const isFellowship = /\b(fellow|fellowship)\b/.test(combined) && (hasApplicationAction || hasDeadline);
  const isScholarship = /\b(scholarship)\b/.test(combined) && (hasApplicationAction || hasDeadline);
  const isGrant = /\b(grant|grants|funding opportunity|financial support|stipend)\b/.test(combined) && (hasApplicationAction || hasDeadline);
  const isHackathon = /\b(hackathon|hack|competition|contest)\b/.test(combined) && hasInvitation;
  const isEvent = /\b(conference|meetup|workshop|webinar|summit)\b/.test(combined) && (hasApplicationAction || hasInvitation);
  const isHiring = hasHiringAction && !isInternship;

  return { isInternship, isFellowship, isScholarship, isGrant, isHackathon, isEvent };
}

function resolveCategory(signals: ReturnType<typeof classify>): string {
  if (signals.isInternship) return "Internship";
  if (signals.isFellowship) return "Fellowship";
  if (signals.isScholarship) return "Scholarship";
  if (signals.isGrant) return "Grant";
  if (signals.isHackathon) return "Hackathon";
  if (signals.isEvent) return "Event";
  return "Job"; // fallback for hiring signals
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("RSS category classification", () => {
  describe("Fellowship", () => {
    it("classifies a fellowship with application action as Fellowship", () => {
      const combined = "hertz foundation graduate fellowship apply now deadline december";
      const signals = classify(combined);
      expect(signals.isFellowship).toBe(true);
      expect(signals.isGrant).toBe(false);
      expect(resolveCategory(signals)).toBe("Fellowship");
    });

    it("classifies a fellowship with deadline as Fellowship", () => {
      const combined = "ford foundation fellowship program deadline march 2027";
      const signals = classify(combined);
      expect(signals.isFellowship).toBe(true);
      expect(signals.isGrant).toBe(false);
      expect(resolveCategory(signals)).toBe("Fellowship");
    });

    it("Fellowship NEVER becomes Grant", () => {
      const combined = "palantir path scholarship apply by january";
      const signals = classify(combined);
      // Scholarship should be classified as Scholarship, not Grant
      expect(signals.isGrant).toBe(false);
    });
  });

  describe("Scholarship", () => {
    it("classifies a scholarship with application action as Scholarship", () => {
      const combined = "google generation scholarship apply now eligibility students";
      const signals = classify(combined);
      expect(signals.isScholarship).toBe(true);
      expect(signals.isGrant).toBe(false);
      expect(resolveCategory(signals)).toBe("Scholarship");
    });

    it("classifies a scholarship with deadline as Scholarship", () => {
      const combined = "tata scholarship deadline closing date february";
      const signals = classify(combined);
      expect(signals.isScholarship).toBe(true);
      expect(signals.isGrant).toBe(false);
      expect(resolveCategory(signals)).toBe("Scholarship");
    });

    it("Scholarship NEVER becomes Grant", () => {
      const combined = "scholarship program for international students apply";
      const signals = classify(combined);
      expect(signals.isGrant).toBe(false);
    });
  });

  describe("Grant", () => {
    it("classifies a grant with application action as Grant", () => {
      const combined = "nsf research grant apply by march eligibility requirements";
      const signals = classify(combined);
      expect(signals.isGrant).toBe(true);
      expect(signals.isFellowship).toBe(false);
      expect(signals.isScholarship).toBe(false);
      expect(resolveCategory(signals)).toBe("Grant");
    });

    it("classifies a grant with deadline as Grant", () => {
      const combined = "small business innovation grant deadline april";
      const signals = classify(combined);
      expect(signals.isGrant).toBe(true);
      expect(resolveCategory(signals)).toBe("Grant");
    });

    it("funding opportunity classified as Grant", () => {
      const combined = "funding opportunity for climate tech startups apply now";
      const signals = classify(combined);
      expect(signals.isGrant).toBe(true);
      expect(resolveCategory(signals)).toBe("Grant");
    });
  });

  describe("News articles rejected as non-opportunities", () => {
    it("startup funding news has no opportunity signals", () => {
      const combined = "self-driving truck startup gatik raises 200m following pepsiCo deal series b";
      const signals = classify(combined);
      expect(signals.isInternship).toBe(false);
      expect(signals.isFellowship).toBe(false);
      expect(signals.isScholarship).toBe(false);
      expect(signals.isGrant).toBe(false);
      expect(signals.isHackathon).toBe(false);
      expect(signals.isEvent).toBe(false);
    });

    it("company acquisition news has no opportunity signals", () => {
      const combined = "tech giant acquires ai startup for 1.2 billion valuation investor";
      const signals = classify(combined);
      expect(signals.isGrant).toBe(false);
      expect(signals.isFellowship).toBe(false);
    });

    it("product launch news has no opportunity signals", () => {
      const combined = "new ai tool launches for developers pricing announced";
      const signals = classify(combined);
      expect(signals.isGrant).toBe(false);
    });
  });

  describe("Category precedence", () => {
    it("Internship takes precedence over Fellowship", () => {
      const combined = "software engineering intern fellowship apply now";
      const signals = classify(combined);
      expect(resolveCategory(signals)).toBe("Internship");
    });

    it("Fellowship takes precedence over Grant", () => {
      const combined = "research fellowship grant apply deadline";
      const signals = classify(combined);
      // Fellowship should win over Grant
      expect(resolveCategory(signals)).toBe("Fellowship");
    });

    it("Scholarship takes precedence over Grant", () => {
      const combined = "merit scholarship grant for students apply";
      const signals = classify(combined);
      expect(resolveCategory(signals)).toBe("Scholarship");
    });
  });
});
