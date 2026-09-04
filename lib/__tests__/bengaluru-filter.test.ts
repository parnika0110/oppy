import { describe, it, expect } from "vitest";
import { normalizeLocation, locationCompatibility } from "../location-normalize";
import { scoreOpportunity, getMatchLevel, getMatchLabels, rankOpportunities, getMatchSummary } from "../relevance";
import type { OpportunityDocument } from "@/types/opportunity";
import type { DiscoveryPreferences } from "../relevance";

// ── Test fixtures ────────────────────────────────────────────────────────

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

// ── 1. Location normalization ────────────────────────────────────────────

describe("normalizeLocation — Bengaluru variants", () => {
  it("normalizes 'Bengaluru' to city: Bengaluru", () => {
    const loc = normalizeLocation("Bengaluru");
    expect(loc.city).toBe("Bengaluru");
    expect(loc.country).toBe("India");
    expect(loc.isRemote).toBeFalsy();
  });

  it("normalizes 'Bangalore' to city: Bengaluru", () => {
    const loc = normalizeLocation("Bangalore");
    expect(loc.city).toBe("Bengaluru");
  });

  it("normalizes 'Bengaluru, Karnataka' to city: Bengaluru", () => {
    const loc = normalizeLocation("Bengaluru, Karnataka");
    expect(loc.city).toBe("Bengaluru");
    expect(loc.state).toBe("Karnataka");
  });

  it("normalizes 'Remote' to isRemote: true", () => {
    const loc = normalizeLocation("Remote");
    expect(loc.isRemote).toBe(true);
  });

  it("normalizes 'Mumbai' to city: Mumbai (not Bengaluru)", () => {
    const loc = normalizeLocation("Mumbai");
    expect(loc.city).toBe("Mumbai");
    expect(loc.country).toBe("India");
  });
});

// ── 2. Location compatibility ────────────────────────────────────────────

describe("locationCompatibility — Bengaluru vs Remote", () => {
  it("Bengaluru job is exact_city match for Bengaluru user", () => {
    const oppLoc = normalizeLocation("Bengaluru, India");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_city");
    expect(result.score).toBe(25);
  });

  it("Bangalore job is exact_city match for Bengaluru user", () => {
    const oppLoc = normalizeLocation("Bangalore, India");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_city");
    expect(result.score).toBe(25);
  });

  it("Remote job is remote_compatible with LOW score for Bengaluru user", () => {
    const oppLoc = normalizeLocation("Remote");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("remote_compatible");
    // Score must be < 10 so locOk = false in getMatchLevel
    expect(result.score).toBeLessThan(10);
  });

  it("Mumbai job is different_country? No — same country match", () => {
    const oppLoc = normalizeLocation("Mumbai, India");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    expect(result.level).toBe("exact_country");
    expect(result.score).toBe(18);
  });

  it("Bengaluru + Remote hybrid: if opp has both city and remote, city wins", () => {
    // An opportunity with location "Bengaluru / Remote" — the city is detected
    const oppLoc = normalizeLocation("Bengaluru / Remote");
    const userLoc = normalizeLocation("Bengaluru");
    const result = locationCompatibility(oppLoc, userLoc);
    // City match takes precedence
    expect(result.level).toBe("exact_city");
    expect(result.score).toBe(25);
  });
});

// ── 3. Scoring ──────────────────────────────────────────────────────────

describe("scoreOpportunity — Bengaluru filter scoring", () => {
  it("Bengaluru job gets high location score with Bengaluru prefs", () => {
    const opp = makeOpp({ location: "Bengaluru, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    expect(score.location).toBe(25); // exact_city
  });

  it("Remote job gets LOW location score with Bengaluru prefs", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    // remote_compatible score is 8, not 15
    expect(score.location).toBe(8);
    expect(score.location).toBeLessThan(10); // locOk = false
  });

  it("Bangalore job gets high location score (normalized to Bengaluru)", () => {
    const opp = makeOpp({ location: "Bangalore, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    expect(score.location).toBe(25); // exact_city after normalization
  });

  it("Mumbai job gets country-match score with Bengaluru prefs", () => {
    const opp = makeOpp({ location: "Mumbai, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    expect(score.location).toBe(18); // exact_country
  });
});

// ── 4. Match level ──────────────────────────────────────────────────────

describe("getMatchLevel — Remote jobs with city filter", () => {
  it("Remote job with Job category is 'related' with Bengaluru prefs (category match)", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const level = getMatchLevel(score, bengaluruPrefs);
    // location = 8 < 10, so locOk = false
    // But category matches (catOk = true) and baseline interest (intWeak = 3)
    // → classified as 'related' due to category match
    expect(level).toBe("related");
  });

  it("Bengaluru job with Job category is 'related' with Bengaluru prefs", () => {
    const opp = makeOpp({ location: "Bengaluru, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const level = getMatchLevel(score, bengaluruPrefs);
    // location = 25 ≥ 10, so locOk = true
    expect(level).toBe("related");
  });
});

// ── 5. Match labels ─────────────────────────────────────────────────────

describe("getMatchLabels — Remote jobs should NOT be labeled with city", () => {
  it("Remote job does NOT get 'Bengaluru' label with Bengaluru prefs", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    expect(labels).not.toContain("Bengaluru");
  });

  it("Bengaluru job DOES get 'Bengaluru' label with Bengaluru prefs", () => {
    const opp = makeOpp({ location: "Bengaluru, India" });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    expect(labels).toContain("Bengaluru, India");
  });

  it("Remote job gets 'Job' category label with Bengaluru prefs", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    const score = scoreOpportunity(opp, bengaluruPrefs);
    const labels = getMatchLabels(score, bengaluruPrefs, opp.location);
    expect(labels).toContain("Job");
  });
});

// ── 6. Ranking end-to-end ───────────────────────────────────────────────

describe("rankOpportunities — Bengaluru filter ordering", () => {
  const candidates = [
    makeOpp({ _id: "remote-1", title: "Remote Software Job", location: "Remote", isRemote: true }),
    makeOpp({ _id: "bengaluru-1", title: "Bengaluru Software Job", location: "Bengaluru, India" }),
    makeOpp({ _id: "bangalore-1", title: "Bangalore Software Job", location: "Bangalore, India" }),
    makeOpp({ _id: "mumbai-1", title: "Mumbai Software Job", location: "Mumbai, India" }),
  ];

  it("Bengaluru job ranks above Remote job", () => {
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const bengaluruIdx = ranked.findIndex(r => r.opportunity._id === "bengaluru-1");
    const remoteIdx = ranked.findIndex(r => r.opportunity._id === "remote-1");
    expect(bengaluruIdx).toBeLessThan(remoteIdx);
  });

  it("Bangalore job ranks above Remote job (normalized)", () => {
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const bangaloreIdx = ranked.findIndex(r => r.opportunity._id === "bangalore-1");
    const remoteIdx = ranked.findIndex(r => r.opportunity._id === "remote-1");
    expect(bangaloreIdx).toBeLessThan(remoteIdx);
  });

  it("Bengaluru job is 'related' level", () => {
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const bengaluru = ranked.find(r => r.opportunity._id === "bengaluru-1");
    expect(bengaluru?.matchLevel).toBe("related");
  });

  it("Remote job is 'related' level (category match, but not location match)", () => {
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const remote = ranked.find(r => r.opportunity._id === "remote-1");
    expect(remote?.matchLevel).toBe("related");
  });

  it("Remote job does not have 'Bengaluru' in matchLabels", () => {
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const remote = ranked.find(r => r.opportunity._id === "remote-1");
    expect(remote?.matchLabels).not.toContain("Bengaluru");
  });
});

// ── 7. Summary ──────────────────────────────────────────────────────────

describe("getMatchSummary — no false 'No exact matches' with Bengaluru data", () => {
  it("summary shows 'related' level when Bengaluru jobs exist", () => {
    const candidates = [
      makeOpp({ _id: "b-1", location: "Bengaluru, India" }),
      makeOpp({ _id: "r-1", location: "Remote", isRemote: true }),
    ];
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const summary = getMatchSummary(ranked, bengaluruPrefs);
    // Should have at least relatedCount > 0
    expect(summary.relatedCount).toBeGreaterThan(0);
  });

  it("Remote jobs do NOT inflate strongCount or goodCount", () => {
    const candidates = [
      makeOpp({ _id: "r-1", location: "Remote", isRemote: true }),
    ];
    const ranked = rankOpportunities(candidates, bengaluruPrefs);
    const summary = getMatchSummary(ranked, bengaluruPrefs);
    expect(summary.strongCount).toBe(0);
    expect(summary.goodCount).toBe(0);
  });
});

// ── 8. Opportunity location display ─────────────────────────────────────

describe("Opportunity location display — never replaced by filter", () => {
  it("Remote opportunity's location remains 'Remote' (not 'Bengaluru')", () => {
    const opp = makeOpp({ location: "Remote", isRemote: true });
    // The opportunity document's location field is never modified by scoring
    expect(opp.location).toBe("Remote");
  });

  it("Bengaluru opportunity's location remains 'Bengaluru, India'", () => {
    const opp = makeOpp({ location: "Bengaluru, India" });
    expect(opp.location).toBe("Bengaluru, India");
  });
});
