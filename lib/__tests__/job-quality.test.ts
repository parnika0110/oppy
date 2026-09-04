/**
 * Job-quality helper tests: seniority filter (conservative, OPPY is
 * student/early-career focused) and apply-URL selection (never fabricated).
 */

import { describe, it, expect } from "vitest";
import {
  isSeniorOnlyTitle,
  isEarlyCareerEligibleJob,
  selectApplicationUrl,
} from "@/lib/ingestion/job-quality";

// ── Seniority filter: senior-only roles must be rejected ────────────────────

describe("seniority filter — observed senior-only production examples", () => {
  const seniorOnly: string[] = [
    "Sr. Director, Software Engineering",
    "Staff Software Engineer",
    "Principal Data Scientist",
    "Platform Architect",
    "Senior Full-Stack Developer",
    "Senior Software Engineer - Full Stack",
    "Staff Backend Software Engineer Remote or Hybrid",
    "Senior Front End Engineer at Network Platform",
    "Senior Fullstack Engineer — Bucket Robotics (YC S24)",
    "Engineering Manager",
    "Senior AI Engineer (Python)",
    "Principal Software Engineer, Front End Web UI Platform",
  ];

  for (const title of seniorOnly) {
    it(`rejects senior-only title: ${title.slice(0, 60)}`, () => {
      expect(isSeniorOnlyTitle(title)).toBe(true);
      expect(isEarlyCareerEligibleJob(title)).toBe(false);
    });
  }
});

describe("seniority filter — legitimate roles must be preserved", () => {
  const eligible: string[] = [
    "Software Engineering Intern",
    "Machine Learning Intern",
    "Data Science Intern",
    "Product Management Intern",
    "Quality Assurance Intern",
    "Graduate Software Engineer",
    "Entry Level Software Engineer",
    "Junior Software Developer",
    "Software Engineer I",
    "Software Engineer",
    "Software Engineering Intern, Bengaluru",
    "Student Developer Program",
    "New Grad Software Engineer",
    "Software Engineer (New Grad 2026)",
    "Associate Software Engineer",
    "Frontend Developer",
    "QA Tester",
  ];

  for (const title of eligible) {
    it(`preserves early-career / non-senior title: ${title.slice(0, 60)}`, () => {
      expect(isSeniorOnlyTitle(title)).toBe(false);
      expect(isEarlyCareerEligibleJob(title)).toBe(true);
    });
  }
});

describe("seniority filter — early-career markers override senior markers", () => {
  it("keeps roles that mix senior wording with an early-career signal", () => {
    // These sound odd but the early-career signal is what matters — never
    // aggressively discard a real internship/graduate posting.
    expect(isEarlyCareerEligibleJob("Senior Software Engineer Intern")).toBe(true);
    expect(isEarlyCareerEligibleJob("Staff Engineer — Graduate Program")).toBe(true);
    expect(isEarlyCareerEligibleJob("Engineering Manager Trainee")).toBe(true);
  });

  it("never fabricates seniority from unrelated words", () => {
    // "International", "Internal", "General" contain no senior marker.
    expect(isSeniorOnlyTitle("International Graduate Engineer")).toBe(false);
    expect(isSeniorOnlyTitle("Internal Tools Engineer")).toBe(false);
  });
});

describe("seniority filter — experience field", () => {
  it("rejects roles demanding more than 4 years when the provider says so", () => {
    expect(
      isEarlyCareerEligibleJob("Software Engineer", 60) // 5 years
    ).toBe(false);
  });

  it("allows roles at or under the experience threshold", () => {
    expect(isEarlyCareerEligibleJob("Software Engineer", 24)).toBe(true);
    expect(isEarlyCareerEligibleJob("Software Engineer", 48)).toBe(true);
  });

  it("treats missing experience data as eligible (never guess)", () => {
    expect(isEarlyCareerEligibleJob("Software Engineer", undefined)).toBe(true);
    expect(isEarlyCareerEligibleJob("Software Engineer", NaN)).toBe(true);
    expect(isEarlyCareerEligibleJob("Software Engineer", Number("not-a-number"))).toBe(true);
  });
});

// ── Apply-URL selection ─────────────────────────────────────────────────────

describe("selectApplicationUrl", () => {
  it("prefers job_apply_link", () => {
    const url = selectApplicationUrl({
      job_apply_link: "https://boards.greenhouse.io/oppy/jobs/1",
      job_url: "https://bebee.com/x/y",
    });
    expect(url).toBe("https://boards.greenhouse.io/oppy/jobs/1");
  });

  it("falls back to job_google_link then job_url", () => {
    expect(
      selectApplicationUrl({
        job_google_link: "https://google.com/cache/1",
      })
    ).toBe("https://google.com/cache/1");
    expect(
      selectApplicationUrl({ job_url: "https://www.indeed.com/viewjob?jk=1" })
    ).toBe("https://www.indeed.com/viewjob?jk=1");
  });

  it("passes aggregator URLs through verbatim (never fabricates a direct URL)", () => {
    for (const aggregator of [
      "https://bebee.com/us/jobs/some-senior-full-stack-role",
      "https://www.shine.com/job/xyz",
      "https://jobleads.com/us/job/1234",
      "https://www.learn4good.com/jobs/glen-burnie/maryland/software",
    ]) {
      expect(
        selectApplicationUrl({
          job_apply_link: aggregator,
          employer_website: "https://acme-corp.example.com",
        })
      ).toBe(aggregator);
    }
  });

  it("never uses employer_website as an application URL", () => {
    // Only an employer website present → no usable apply URL → "".
    expect(
      selectApplicationUrl({ employer_website: "https://acme.example.com" })
    ).toBe("");
  });

  it("rejects malformed/non-http URLs and keeps searching", () => {
    expect(
      selectApplicationUrl({
        job_apply_link: "https:&#x2F;&#x2F;broken.example.com",
        job_url: "https://careers.example.com/apply",
      })
    ).toBe("https://careers.example.com/apply");
    expect(selectApplicationUrl({ job_apply_link: "not a url" })).toBe("");
  });

  it("returns empty string when no URL is supplied at all", () => {
    expect(selectApplicationUrl({})).toBe("");
    expect(selectApplicationUrl(null)).toBe("");
    expect(selectApplicationUrl(undefined)).toBe("");
  });
});
