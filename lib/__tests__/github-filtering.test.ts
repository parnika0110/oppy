import { describe, it, expect } from "vitest";
import { GitHubProgramsSource } from "@/lib/ingestion/sources/github-programs";

describe("GitHubProgramsSource.isOpportunity", () => {
  // ── Should REJECT (not opportunities) ──

  it("rejects Good First Issues", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "[Good First Issue] Add new Learner Mistake 94",
        labels: [{ name: "good first issue" }],
      })
    ).toBe(false);
  });

  it("rejects Good First Issues without label if title matches", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Good first issue: Add Portuguese contributor quickstart",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects ZAP security scans", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "ZAP Baseline Scan — 32707304881",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects ZAP DAST scans", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "ZAP DAST 취약점 발견",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects fix commits", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Fix Missing Semicolon in student.c",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects feature commits", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "feat(pwa): Offline study logging",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects perf commits", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "perf: Lazy load heavy third-party libraries",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects docs commits", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "docs: Improve project documentation",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects chore commits", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "chore: update dependencies",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects enhancement issues", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "[Enhancement]: Add New Resources",
        labels: [{ name: "enhancement" }],
      })
    ).toBe(false);
  });

  it("rejects issues with bug label", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "SubGraph.process raises NameError",
        labels: [{ name: "bug" }],
      })
    ).toBe(false);
  });

  it("rejects issues with documentation label", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Improve README Documentation",
        labels: [{ name: "documentation" }],
      })
    ).toBe(false);
  });

  it("rejects security label", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Fix: Harden pull request automation",
        labels: [{ name: "security" }],
      })
    ).toBe(false);
  });

  it("rejects automated project tracking", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Automated project completion tracking",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects category request issues", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Category request: agent-native programming languages",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects windows support feature requests", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "[Feature]: Windows 10 support and releasing the source",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects portfolio PRs", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Portfolio archaeology batch 1 — collapse",
        labels: [],
      })
    ).toBe(false);
  });

  it("rejects DeFi adapter PRs", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Add prodigyfi V2 adapter",
        labels: [],
      })
    ).toBe(false);
  });

  // ── Should ACCEPT (actual opportunities) ──

  it("accepts GitHub Campus Experts", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "GitHub Campus Experts Program",
        labels: [{ name: "campus-experts" }],
      })
    ).toBe(true);
  });

  it("accepts GSoC issues", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "GSoC 2026 project ideas for ML library",
        labels: [{ name: "gsoc" }],
      })
    ).toBe(true);
  });

  it("accepts Hacktoberfest issues", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Hacktoberfest contribution guidelines",
        labels: [{ name: "hacktoberfest" }],
      })
    ).toBe(true);
  });

  it("accepts open source program announcements", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Summer of Code program now accepting applications",
        labels: [],
      })
    ).toBe(true);
  });

  it("accepts student ambassador programs", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Microsoft Student Ambassador Program",
        labels: [{ name: "student" }],
      })
    ).toBe(true);
  });

  // ── Edge cases ──

  it("rejects issues with multiple labels where one is rejected", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "Add new feature to student portal",
        labels: [{ name: "student" }, { name: "good first issue" }],
      })
    ).toBe(false);
  });

  it("accepts empty title with no rejected labels", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "",
        labels: [],
      })
    ).toBe(true);
  });

  it("handles undefined labels gracefully", () => {
    expect(
      GitHubProgramsSource.isOpportunity({
        title: "GSoC project",
        labels: undefined as any,
      })
    ).toBe(true);
  });
});

describe("GitHub Programs - non-opportunity pattern detection", () => {
  const nonOpportunityPatterns = [
    "[Good First Issue] Add new Learner Mistake 94",
    "ZAP Baseline Scan — 32707304881",
    "ZAP Full Scan Report (Nisha318/operation-aegis)",
    "ZAP DAST 취약점 발견 (gisskso-lab/hitpan-erp)",
    "Fix Missing Semicolon in student.c",
    "Fix and Improve Developer Account Linking",
    "Fix release publishing permission in build-modules workflow",
    "Fix: Harden pull request automation against injection",
    "Gate merges on Kani, unblock kani-full",
    "feat(pwa): Offline study logging & automatic synchronization",
    "perf: Lazy load heavy third-party libraries",
    "docs: Improve project documentation",
    "docs: refine Kimi feature and sponsor layout",
    "chore: update dependencies",
    "Automated project completion tracking",
    "Category request: agent-native programming languages",
    "Increase the maximum value limit",
    "Normalize Windows paths in export()",
    "Single landing page for Chadbox Engine",
    "SubGraph.process raises NameError",
    "[FEAT]: End-to-End Synthetic Data Generator",
    "[Feature]: Windows 10 support",
    "Portfolio archaeology batch 1",
    "Add prodigyfi V2 adapter",
    "Prepare to enroll as a trainee",
    "Run the first real-world Axoloth onboarding usability test",
    "Get does not parse line continuation character",
    "Guidelines",
    "Improve README Documentation",
  ];

  for (const title of nonOpportunityPatterns) {
    it(`rejects: "${title.substring(0, 50)}..."`, () => {
      expect(
        GitHubProgramsSource.isOpportunity({
          title,
          labels: [],
        })
      ).toBe(false);
    });
  }
});
