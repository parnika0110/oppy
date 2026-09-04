import { describe, it, expect } from "vitest";
import { normalizeLocation, locationCompatibility } from "../location-normalize";
import {
  scoreOpportunity,
  getMatchLevel,
  getMatchLabels,
  rankOpportunities,
  getMatchSummary,
} from "../relevance";
import type { OpportunityDocument } from "@/types/opportunity";
import type { DiscoveryPreferences } from "../relevance";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeOpp(overrides: Partial<OpportunityDocument> = {}): OpportunityDocument {
  return {
    _id: "test-1",
    title: "Software Engineering Job",
    organization: "Acme Corp",
    category: "Job",
    location: "Bengaluru, India",
    tags: ["python", "engineering"],
    description: "A great software engineering job opportunity.",
    applicationLink: "https://example.com/apply",
    deadline: null,
    deadlineKind: "unavailable",
    isActive: true,
    aiSummary: null,
    categoryValidation: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const bengaluruPrefs: DiscoveryPreferences = {
  categories: ["Job"],
  location: "Bengaluru",
};

const indiaPrefs: DiscoveryPreferences = {
  categories: ["Job"],
  location: "India",
};

// ── Scenario 1: User = Bengaluru, Opp = Bengaluru ─────────────────────────

describe("Scenario 1: User Bengaluru → Opp Bengaluru", () => {
  it("is exact_city compatible with score ≥ 10", () => {
    const oppLoc = normalizeLocation("Bengaluru");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_city");
    expect(result.score).toBeGreaterThanOrEqual(10);
  });

  it("receives Bengaluru label (full location)", () => {
    const opp = makeOpp({ location: "Bengaluru, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    expect(labels).toContain("Bengaluru, India");
  });

  it("ranks above Remote and Mumbai", () => {
    const candidates = [
      makeOpp({ _id: "blr", title: "BLR Job", location: "Bengaluru, India" }),
      makeOpp({ _id: "remote", title: "Remote Job", location: "Remote", isRemote: true }),
      makeOpp({ _id: "mum", title: "Mumbai Job", location: "Mumbai, India" }),
    ];
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const blrIdx = ranked.findIndex(r => r.opportunity._id === "blr");
    const remoteIdx = ranked.findIndex(r => r.opportunity._id === "remote");
    const mumIdx = ranked.findIndex(r => r.opportunity._id === "mum");
    expect(blrIdx).toBeLessThan(remoteIdx);
    expect(blrIdx).toBeLessThan(mumIdx);
  });
});

// ── Scenario 2: User = Bengaluru, Opp = Bangalore ─────────────────────────

describe("Scenario 2: User Bengaluru → Opp Bangalore (normalized equivalent)", () => {
  it("Bangalore normalizes to Bengaluru", () => {
    const loc = normalizeLocation("Bangalore");
    expect(loc.city).toBe("Bengaluru");
  });

  it("is exact_city compatible", () => {
    const oppLoc = normalizeLocation("Bangalore");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_city");
    expect(result.score).toBe(25);
  });

  it("Bangalore gets same score as Bengaluru", () => {
    const blr = makeOpp({ location: "Bengaluru, India" });
    const bng = makeOpp({ location: "Bangalore, India" });
    const blrScore = scoreOpportunity(blr, bengaluruPrefs);
    const bngScore = scoreOpportunity(bng, bengaluruPrefs);
    expect(blrScore.location).toBe(bngScore.location);
  });
});

// ── Scenario 3: User = Bengaluru, Opp = Mumbai ────────────────────────────

describe("Scenario 3: User Bengaluru → Opp Mumbai", () => {
  it("is exact_country, NOT exact_city", () => {
    const oppLoc = normalizeLocation("Mumbai");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_country");
    expect(result.score).toBe(18);
  });

  it("does NOT receive Bengaluru label — shows Mumbai instead", () => {
    const opp = makeOpp({ location: "Mumbai, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    expect(labels).not.toContain("Bengaluru");
    expect(labels).toContain("Mumbai, India");
  });

  it("ranks below Bengaluru match", () => {
    const candidates = [
      makeOpp({ _id: "mum", title: "Mumbai Job", location: "Mumbai, India" }),
      makeOpp({ _id: "blr", title: "BLR Job", location: "Bengaluru, India" }),
    ];
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const blrIdx = ranked.findIndex(r => r.opportunity._id === "blr");
    const mumIdx = ranked.findIndex(r => r.opportunity._id === "mum");
    expect(blrIdx).toBeLessThan(mumIdx);
  });
});

// ── Scenario 4: User = Bengaluru, Opp = Remote ────────────────────────────

describe("Scenario 4: User Bengaluru → Opp Remote", () => {
  it("is remote_compatible with score < 10 (NOT locOk)", () => {
    const oppLoc = normalizeLocation("Remote");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("remote_compatible");
    expect(result.score).toBeLessThan(10);
  });

  it("does NOT receive Bengaluru label", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    expect(labels).not.toContain("Bengaluru");
  });

  it("is classified as 'related' (category match, not location match)", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const level = getMatchLevel(score, bengaluruPrefs);
    expect(level).toBe("related");
  });

  it("ranks below Bengaluru match", () => {
    const candidates = [
      makeOpp({ _id: "remote", title: "Remote Job", location: "Remote", isRemote: true }),
      makeOpp({ _id: "blr", title: "BLR Job", location: "Bengaluru, India" }),
    ];
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const blrIdx = ranked.findIndex(r => r.opportunity._id === "blr");
    const remoteIdx = ranked.findIndex(r => r.opportunity._id === "remote");
    expect(blrIdx).toBeLessThan(remoteIdx);
  });
});

// ── Scenario 5: User = Bengaluru, Opp = Bengaluru / Remote ────────────────

describe("Scenario 5: User Bengaluru → Opp Bengaluru / Remote (hybrid)", () => {
  it("Bengaluru / Remote preserves both city and remote", () => {
    const loc = normalizeLocation("Bengaluru / Remote");
    expect(loc.city).toBe("Bengaluru");
    expect(loc.isRemote).toBe(true);
  });

  it("city match takes precedence over remote_compatible", () => {
    const oppLoc = normalizeLocation("Bengaluru / Remote");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_city");
    expect(result.score).toBe(25);
  });

  it("receives Bengaluru label (hybrid preserved)", () => {
    const opp = makeOpp({ location: "Bengaluru / Remote" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    expect(labels).toContain("Bengaluru / Remote");
  });
});

// ── Scenario 6: User = India, Opp = Remote ────────────────────────────────

describe("Scenario 6: User India → Opp Remote", () => {
  it("is remote_compatible with low score", () => {
    const oppLoc = normalizeLocation("Remote");
    const userLoc = normalizeLocation("India");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("remote_compatible");
    expect(result.score).toBe(8);
  });

  it("does NOT receive a specific city label", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, indiaPrefs);
    const labels = getMatchLabels(score, indiaPrefs, opp.location);
    // Should not have any city label
    expect(labels).not.toContain("Bengaluru");
    expect(labels).not.toContain("Mumbai");
    expect(labels).not.toContain("Delhi");
  });

  it("receives category label (Job)", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, indiaPrefs);
    const labels = getMatchLabels(score, indiaPrefs, opp.location);
    expect(labels).toContain("Job");
  });
});

// ── Scenario 7: User = India, Opp = Mumbai ────────────────────────────────

describe("Scenario 7: User India → Opp Mumbai", () => {
  it("is exact_country compatible", () => {
    const oppLoc = normalizeLocation("Mumbai");
    const userLoc = normalizeLocation("India");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_country");
    expect(result.score).toBe(18);
  });

  it("Mumbai gets higher location score than Remote with India prefs", () => {
    const mum = makeOpp({ location: "Mumbai, India" });
    const remote = makeOpp({ location: "Remote", isRemote: true });
    const mumScore = scoreOpportunity(mum, indiaPrefs);
    const remoteScore = scoreOpportunity(remote, indiaPrefs);
    expect(mumScore.location).toBeGreaterThan(remoteScore.location);
  });
});

// ── Scenario 8: User = Bengaluru, Opp = Mumbai ranks below Bengaluru ──────

describe("Scenario 8: User Bengaluru → Mumbai ranks below Bengaluru", () => {
  it("Bengaluru location score (25) > Mumbai location score (18)", () => {
    const blr = makeOpp({ location: "Bengaluru, India" });
    const mum = makeOpp({ location: "Mumbai, India" });
    const blrScore = scoreOpportunity(blr, bengaluruPrefs);
    const mumScore = scoreOpportunity(mum, bengaluruPrefs);
    expect(blrScore.location).toBeGreaterThan(mumScore.location);
  });

  it("full ranking puts Bengaluru above Mumbai", () => {
    const candidates = [
      makeOpp({ _id: "blr", title: "BLR Job", location: "Bengaluru, India" }),
      makeOpp({ _id: "mum", title: "Mumbai Job", location: "Mumbai, India" }),
    ];
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const blrIdx = ranked.findIndex(r => r.opportunity._id === "blr");
    const mumIdx = ranked.findIndex(r => r.opportunity._id === "mum");
    expect(blrIdx).toBeLessThan(mumIdx);
  });
});

// ── UI query: ?categories=Internship&interests=Web+Development&location=India&experience=Student ──

describe("UI query: categories=Internship&location=India", () => {
  const uiPrefs: DiscoveryPreferences = {
    categories: ["Internship"],
    location: "India",
  };

  const testCandidates = [
    makeOpp({ _id: "blr-intern", title: "BLR Intern", location: "Bengaluru, India", category: "Internship" }),
    makeOpp({ _id: "mum-intern", title: "Mumbai Intern", location: "Mumbai, India", category: "Internship" }),
    makeOpp({ _id: "remote-intern", title: "Remote Intern", location: "Remote", isRemote: true, category: "Internship" }),
    makeOpp({ _id: "blr-job", title: "BLR Job", location: "Bengaluru, India", category: "Job" }),
    makeOpp({ _id: "us-intern", title: "US Intern", location: "San Francisco, USA", category: "Internship" }),
  ];

  it("exact matches include India-location internships", () => {
    const ranked = rankOpportunities(testCandidates, uiPrefs);
    const summary = getMatchSummary(ranked, uiPrefs);
    // BLR and Mumbai internships should be at least 'related' (category + location match)
    expect(summary.relatedCount + summary.strongCount + summary.goodCount).toBeGreaterThanOrEqual(2);
  });

  it("Remote internships are not excluded (shown as related)", () => {
    const ranked = rankOpportunities(testCandidates, uiPrefs);
    const remote = ranked.find(r => r.opportunity._id === "remote-intern");
    expect(remote).toBeDefined();
    expect(remote?.matchLevel).toBeDefined();
  });

  it("US internship ranks below India matches", () => {
    const ranked = rankOpportunities(testCandidates, uiPrefs);
    const usIdx = ranked.findIndex(r => r.opportunity._id === "us-intern");
    const blrIdx = ranked.findIndex(r => r.opportunity._id === "blr-intern");
    const mumIdx = ranked.findIndex(r => r.opportunity._id === "mum-intern");
    // US should be below both India cities
    expect(usIdx).toBeGreaterThan(blrIdx);
    expect(usIdx).toBeGreaterThan(mumIdx);
  });

  it("Bengaluru internship gets its actual location label", () => {
    const opp = makeOpp({ location: "Bengaluru, India", category: "Internship" });
    const score = scoreOpportunity(opp, uiPrefs);
    const labels = getMatchLabels(score, uiPrefs, opp.location);
    expect(labels).toContain("Bengaluru, India");
    expect(labels).toContain("Internship");
  });

  it("Remote opportunity location chip shows 'Remote', not 'India'", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true, category: "Internship" });
    // The opportunity document's location field is never modified
    expect(opp.location).toBe("Remote");
    // Labels should not include a city
    const score = scoreOpportunity(opp, uiPrefs);
    const labels = getMatchLabels(score, uiPrefs, opp.location);
    expect(labels).not.toContain("Bengaluru");
    expect(labels).not.toContain("Mumbai");
    expect(labels).not.toContain("India");
  });

  it("city matches rank above generic Remote matches", () => {
    const candidates = [
      makeOpp({ _id: "remote", title: "Remote", location: "Remote", isRemote: true, category: "Internship" }),
      makeOpp({ _id: "blr", title: "BLR", location: "Bengaluru, India", category: "Internship" }),
      makeOpp({ _id: "mum", title: "Mumbai", location: "Mumbai, India", category: "Internship" }),
    ];
    const ranked = rankOpportunities(candidates, uiPrefs);
    const remoteIdx = ranked.findIndex(r => r.opportunity._id === "remote");
    const blrIdx = ranked.findIndex(r => r.opportunity._id === "blr");
    const mumIdx = ranked.findIndex(r => r.opportunity._id === "mum");
    expect(blrIdx).toBeLessThan(remoteIdx);
    expect(mumIdx).toBeLessThan(remoteIdx);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("empty location preference returns all candidates", () => {
    const noLocPrefs: DiscoveryPreferences = { categories: ["Job"] };
    const candidates = [
      makeOpp({ _id: "a", location: "Bengaluru" }),
      makeOpp({ _id: "b", location: "Remote", isRemote: true }),
    ];
    const ranked = rankOpportunities(candidates, noLocPrefs);
    expect(ranked.length).toBe(2);
  });

  it("'See posting' location does not match any city", () => {
    const oppLoc = normalizeLocation("See posting");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    // See posting → no city, no country → should not be exact_city
    expect(result.level).not.toBe("exact_city");
  });

  it("location chip on card always shows opportunity's actual location", () => {
    const opp = makeOpp({ location: "Mumbai, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    // Even though user prefers Bengaluru, the opp location remains Mumbai
    expect(opp.location).toBe("Mumbai, India");
    // Labels should show the OPPORTUNITY's location, not the user's filter
    expect(labels).toContain("Mumbai, India");
    expect(labels).not.toContain("Bengaluru");
  });
});
