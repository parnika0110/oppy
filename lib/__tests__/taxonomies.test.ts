import { describe, it, expect } from "vitest";
import {
  resolveSkill,
  resolveInterest,
  resolveLocation,
  resolveSkills,
  resolveInterests,
  resolveLocations,
  searchTaxonomy,
  SKILL_TAXONOMY,
  INTEREST_TAXONOMY_ENTRIES,
  LOCATION_TAXONOMY,
  getPopularSkills,
  getPopularInterests,
  getPopularLocations,
} from "../taxonomies";
import { scoreOpportunity, rankOpportunities, type DiscoveryPreferences } from "../relevance";
import type { OpportunityDocument } from "@/types/opportunity";

function makeOpp(overrides: Partial<OpportunityDocument> = {}): OpportunityDocument {
  return {
    _id: "test-1",
    title: "Software Engineering Intern",
    organization: "Acme Corp",
    category: "Internship",
    location: "Remote",
    tags: ["python", "engineering"],
    description: "A great software engineering internship opportunity.",
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

// ── Skill resolution ──────────────────────────────────────────────────────

describe("skill taxonomy resolution", () => {
  it("resolves canonical label", () => {
    const entry = resolveSkill("Python");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("python");
    expect(entry!.label).toBe("Python");
  });

  it("resolves common typo to canonical", () => {
    const entry = resolveSkill("pyhton");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("python");
    expect(entry!.label).toBe("Python");
  });

  it("resolves another typo", () => {
    const entry = resolveSkill("javscript");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("javascript");
  });

  it("resolves alias", () => {
    const entry = resolveSkill("js");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("javascript");
  });

  it("resolves DevOps alias", () => {
    const entry = resolveSkill("dev ops");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("devops");
    expect(entry!.label).toBe("DevOps");
  });

  it("resolves legacy Devop", () => {
    const entry = resolveSkill("devop");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("devops");
  });

  it("resolves case-insensitively", () => {
    const entry = resolveSkill("MACHINE LEARNING");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("machine-learning");
  });

  it("returns null for unknown skill", () => {
    const entry = resolveSkill("quantum computing");
    expect(entry).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveSkill("")).toBeNull();
    expect(resolveSkill("  ")).toBeNull();
  });

  it("resolves QA / Testing", () => {
    const entry = resolveSkill("QA / Testing");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("qa-testing");
  });

  it("resolves 'qa' alias to QA / Testing", () => {
    const entry = resolveSkill("qa");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("qa-testing");
  });

  it("resolves 'testing' alias to QA / Testing", () => {
    const entry = resolveSkill("testing");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("qa-testing");
  });

  it("resolves 'test automation' alias to QA / Testing", () => {
    const entry = resolveSkill("test automation");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("qa-testing");
  });

  it("resolves Frontend Development skill", () => {
    const entry = resolveSkill("Frontend Development");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("frontend-development");
  });

  it("resolves 'frontend' alias to Frontend Development skill", () => {
    const entry = resolveSkill("frontend");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("frontend-development");
  });

  it("resolves Backend Development skill", () => {
    const entry = resolveSkill("Backend Development");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("backend-development");
  });

  it("resolves 'backend' alias to Backend Development skill", () => {
    const entry = resolveSkill("backend");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("backend-development");
  });

  it("resolves Full Stack Development skill", () => {
    const entry = resolveSkill("Full Stack Development");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("full-stack-development");
  });

  it("resolves 'full stack' alias to Full Stack Development skill", () => {
    const entry = resolveSkill("full stack");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("full-stack-development");
  });

  it("resolves Embedded Systems skill", () => {
    const entry = resolveSkill("Embedded Systems");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("embedded-systems");
  });

  it("resolves 'firmware' alias to Embedded Systems skill", () => {
    const entry = resolveSkill("firmware");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("embedded-systems");
  });

  it("resolves Data Annotation skill", () => {
    const entry = resolveSkill("Data Annotation");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("data-annotation");
  });

  it("resolves Technical Writing skill", () => {
    const entry = resolveSkill("Technical Writing");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("technical-writing");
  });

  it("resolves 'documentation' alias to Technical Writing skill", () => {
    const entry = resolveSkill("documentation");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("technical-writing");
  });
});

// ── Interest resolution ───────────────────────────────────────────────────

describe("interest taxonomy resolution", () => {
  it("resolves canonical label", () => {
    const entry = resolveInterest("AI / ML");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("ai-ml");
  });

  it("resolves alias", () => {
    const entry = resolveInterest("machine learning");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("ai-ml");
  });

  it("resolves Game Dev", () => {
    const entry = resolveInterest("Game Dev");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("game-dev");
  });

  it("resolves Game Dev alias", () => {
    const entry = resolveInterest("game development");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("game-dev");
  });

  it("resolves DevOps interest", () => {
    const entry = resolveInterest("devops");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("devops");
  });

  it("resolves Devop legacy alias", () => {
    const entry = resolveInterest("devop");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("devops");
  });

  it("returns null for unknown interest", () => {
    expect(resolveInterest("quantum mechanics")).toBeNull();
  });

  it("resolves Backend Development", () => {
    const entry = resolveInterest("Backend Development");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("backend-development");
  });

  it("resolves 'backend' alias to Backend Development", () => {
    const entry = resolveInterest("backend");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("backend-development");
  });

  it("resolves 'back-end' alias to Backend Development", () => {
    const entry = resolveInterest("back-end");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("backend-development");
  });

  it("resolves Frontend Development", () => {
    const entry = resolveInterest("Frontend Development");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("frontend-development");
  });

  it("resolves 'frontend' alias to Frontend Development", () => {
    const entry = resolveInterest("frontend");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("frontend-development");
  });

  it("resolves Full Stack Development", () => {
    const entry = resolveInterest("Full Stack Development");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("full-stack-development");
  });

  it("resolves 'full stack' alias to Full Stack Development", () => {
    const entry = resolveInterest("full stack");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("full-stack-development");
  });

  it("resolves 'fullstack' alias to Full Stack Development", () => {
    const entry = resolveInterest("fullstack");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("full-stack-development");
  });

  it("resolves Quality Assurance", () => {
    const entry = resolveInterest("Quality Assurance");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("quality-assurance");
  });

  it("resolves 'qa' alias to Quality Assurance", () => {
    const entry = resolveInterest("qa");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("quality-assurance");
  });

  it("resolves 'testing' alias to Quality Assurance", () => {
    const entry = resolveInterest("testing");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("quality-assurance");
  });

  it("resolves 'software testing' alias to Quality Assurance", () => {
    const entry = resolveInterest("software testing");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("quality-assurance");
  });

  it("resolves Data Annotation", () => {
    const entry = resolveInterest("Data Annotation");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("data-annotation");
  });

  it("resolves 'data labeling' alias to Data Annotation", () => {
    const entry = resolveInterest("data labeling");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("data-annotation");
  });

  it("resolves Embedded Systems", () => {
    const entry = resolveInterest("Embedded Systems");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("embedded-systems");
  });

  it("resolves 'embedded' alias to Embedded Systems", () => {
    const entry = resolveInterest("embedded");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("embedded-systems");
  });

  it("resolves 'iot' alias to Embedded Systems", () => {
    const entry = resolveInterest("iot");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("embedded-systems");
  });

  it("resolves Data Analytics", () => {
    const entry = resolveInterest("Data Analytics");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("data-analytics");
  });

  it("resolves 'analytics' alias to Data Analytics", () => {
    const entry = resolveInterest("analytics");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("data-analytics");
  });

  it("resolves 'business intelligence' alias to Data Analytics", () => {
    const entry = resolveInterest("business intelligence");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("data-analytics");
  });
});

// ── Location resolution ───────────────────────────────────────────────────

describe("location taxonomy resolution", () => {
  it("resolves Bengaluru", () => {
    const entry = resolveLocation("Bengaluru");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("bengaluru");
  });

  it("resolves Bangalore alias", () => {
    const entry = resolveLocation("Bangalore");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("bengaluru");
  });

  it("resolves Remote", () => {
    const entry = resolveLocation("Remote");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("remote");
  });

  it("resolves online as Remote", () => {
    const entry = resolveLocation("online");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("remote");
  });

  it("resolves Singapore", () => {
    const entry = resolveLocation("Singapore");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("singapore");
  });

  it("resolves Paris", () => {
    const entry = resolveLocation("Paris");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("paris");
  });

  it("returns null for unknown location", () => {
    expect(resolveLocation("Atlantis")).toBeNull();
  });
});

// ── Bulk resolution ───────────────────────────────────────────────────────

describe("bulk resolution (resolveSkills/Interests/Locations)", () => {
  it("resolves array of skills to canonical labels", () => {
    const result = resolveSkills(["pyhton", "javascript", "dev ops", "randomtext"]);
    expect(result).toContain("Python");
    expect(result).toContain("JavaScript");
    expect(result).toContain("DevOps");
    // "randomtext" is unknown — preserved as-is
    expect(result).toContain("randomtext");
  });

  it("deduplicates by canonical ID", () => {
    const result = resolveSkills(["Python", "pyhton", "python"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Python");
  });

  it("resolves interests with legacy values", () => {
    const result = resolveInterests(["AI / ML", "devop", "game development", "unknown interest"]);
    expect(result).toContain("AI / ML");
    expect(result).toContain("DevOps");
    expect(result).toContain("Game Dev");
    expect(result).toContain("unknown interest");
  });

  it("resolves locations with aliases", () => {
    const result = resolveLocations(["Bangalore", "Remote", "Singapore"]);
    expect(result).toContain("Bengaluru");
    expect(result).toContain("Remote");
    expect(result).toContain("Singapore");
  });

  it("preserves unknown values in arrays", () => {
    const result = resolveSkills(["Python", "my custom tool"]);
    expect(result).toContain("Python");
    expect(result).toContain("my custom tool");
  });
});

// ── Popular items ─────────────────────────────────────────────────────────

describe("popular items", () => {
  it("getPopularSkills returns entries marked popular", () => {
    const popular = getPopularSkills();
    expect(popular.length).toBeGreaterThan(0);
    for (const entry of popular) {
      expect(entry.popular).toBe(true);
    }
    // Should include Python and JavaScript
    expect(popular.map((e) => e.id)).toContain("python");
    expect(popular.map((e) => e.id)).toContain("javascript");
  });

  it("getPopularInterests returns popular interests", () => {
    const popular = getPopularInterests();
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.map((e) => e.id)).toContain("ai-ml");
    expect(popular.map((e) => e.id)).toContain("startups");
  });

  it("getPopularLocations returns popular locations", () => {
    const popular = getPopularLocations();
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.map((e) => e.id)).toContain("remote");
    expect(popular.map((e) => e.id)).toContain("bengaluru");
  });
});

// ── Search ────────────────────────────────────────────────────────────────

describe("searchTaxonomy", () => {
  it("finds entries by label substring", () => {
    const results = searchTaxonomy(SKILL_TAXONOMY, "python");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("python");
  });

  it("finds entries by alias", () => {
    const results = searchTaxonomy(SKILL_TAXONOMY, "ml");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((e) => e.id === "machine-learning")).toBe(true);
  });

  it("excludes selected entries", () => {
    const exclude = new Set(["python"]);
    const results = searchTaxonomy(SKILL_TAXONOMY, "python", exclude);
    expect(results.every((e) => e.id !== "python")).toBe(true);
  });

  it("returns empty for non-matching query", () => {
    const results = searchTaxonomy(SKILL_TAXONOMY, "zzzznonexistent");
    expect(results).toHaveLength(0);
  });
});

// ── Backward compatibility: legacy values in recommendation scoring ───────

describe("backward compatibility with legacy preferences", () => {
  it("legacy 'Devop' interest resolves and scores correctly", () => {
    // Simulate old profile with "Devop" as interest
    const normalized = resolveInterests(["Devop"]);
    expect(normalized).toContain("DevOps");

    const opp = makeOpp({
      title: "DevOps Engineer",
      tags: ["devops", "kubernetes", "docker"],
      description: "Infrastructure automation",
      category: "Job",
    });
    const prefs: DiscoveryPreferences = { interests: normalized };
    const score = scoreOpportunity(opp, prefs);
    expect(score.interests).toBeGreaterThanOrEqual(20);
  });

  it("legacy 'Game Dev' interest resolves and scores correctly", () => {
    const normalized = resolveInterests(["Game Dev"]);
    expect(normalized).toContain("Game Dev");

    const opp = makeOpp({
      title: "Game Developer Intern",
      tags: ["unity", "c#"],
      description: "Build games",
      category: "Internship",
    });
    const prefs: DiscoveryPreferences = { interests: normalized };
    const score = scoreOpportunity(opp, prefs);
    expect(score.interests).toBeGreaterThanOrEqual(15);
  });

  it("legacy 'Bangalore' location resolves and scores correctly", () => {
    const normalized = resolveLocations(["Bangalore"]);
    expect(normalized).toContain("Bengaluru");

    const opp = makeOpp({ location: "Bengaluru, Karnataka" });
    const prefs: DiscoveryPreferences = { location: normalized[0] };
    const score = scoreOpportunity(opp, prefs);
    expect(score.location).toBeGreaterThanOrEqual(20);
  });

  it("legacy 'dev ops' skill resolves and boosts scoring", () => {
    const normalized = resolveSkills(["dev ops"]);
    expect(normalized).toContain("DevOps");

    const opp = makeOpp({
      title: "DevOps Engineer",
      tags: ["devops", "kubernetes"],
      category: "Job",
    });
    const prefs: DiscoveryPreferences = { skills: normalized };
    const score = scoreOpportunity(opp, prefs);
    // Skills should boost the interest score
    expect(score.interests).toBeGreaterThanOrEqual(15);
  });

  it("new canonical preferences score identically to legacy aliases", () => {

    // Old user with typos
    const legacyInterests = resolveInterests(["devop", "game dev"]);
    const legacySkills = resolveSkills(["pyhton", "dev ops"]);
    const legacyLocations = resolveLocations(["Bangalore", "Singapore"]);

    // New user with canonical values
    const newInterests = resolveInterests(["DevOps", "Game Dev"]);
    const newSkills = resolveSkills(["Python", "DevOps"]);
    const newLocations = resolveLocations(["Bengaluru", "Singapore"]);

    const opp = makeOpp({
      title: "Python DevOps Engineer",
      tags: ["python", "devops", "kubernetes"],
      description: "Remote DevOps role in Singapore",
      location: "Singapore",
      category: "Job",
    });

    const legacyPrefs: DiscoveryPreferences = {
      interests: legacyInterests,
      skills: legacySkills,
      location: legacyLocations[0],
      remote: true,
    };

    const newPrefs: DiscoveryPreferences = {
      interests: newInterests,
      skills: newSkills,
      location: newLocations[0],
      remote: true,
    };

    const legacyScore = scoreOpportunity(opp, legacyPrefs);
    const newScore = scoreOpportunity(opp, newPrefs);

    // Both should produce equivalent scores
    expect(legacyScore.total).toBe(newScore.total);
    expect(legacyScore.interests).toBe(newScore.interests);
    expect(legacyScore.location).toBe(newScore.location);
  });
});

// ── Recommendation scoring with canonical preferences ─────────────────────

describe("recommendation scoring with canonical taxonomy", () => {
  it("Python skill matches Python opportunities", () => {
    const pythonOpp = makeOpp({
      _id: "py",
      title: "Python Backend Engineer",
      tags: ["python", "django"],
      category: "Job",
    });
    const nonPython = makeOpp({
      _id: "java",
      title: "Java Enterprise Developer",
      tags: ["java", "spring"],
      category: "Job",
    });
    const prefs: DiscoveryPreferences = { skills: ["Python"] };
    const ranked = rankOpportunities([nonPython, pythonOpp], prefs);
    expect(ranked[0].opportunity._id).toBe("py");
  });

  it("multiple canonical preferences score correctly together", () => {
    const perfect = makeOpp({
      _id: "perfect",
      title: "AI/ML Intern",
      tags: ["ai", "machine learning", "python"],
      category: "Internship",
      location: "Remote",
      isRemote: true,
    });
    const mismatch = makeOpp({
      _id: "mismatch",
      title: "Marketing Coordinator",
      tags: ["marketing", "social media"],
      category: "Job",
      location: "New York",
    });
    const prefs: DiscoveryPreferences = {
      categories: ["Internship"],
      interests: ["AI / ML"],
      skills: ["Python"],
      location: "Remote",
      remote: true,
    };
    const ranked = rankOpportunities([mismatch, perfect], prefs);
    expect(ranked[0].opportunity._id).toBe("perfect");
    expect(ranked[0].score.total).toBeGreaterThan(50);
  });

  it("canonical interest 'DevOps' matches DevOps opportunities", () => {
    const devopsOpp = makeOpp({
      _id: "devops",
      title: "DevOps Engineer",
      tags: ["devops", "kubernetes", "docker"],
      category: "Job",
    });
    const unrelated = makeOpp({
      _id: "design",
      title: "Graphic Designer",
      tags: ["design", "photoshop"],
      category: "Job",
    });
    const prefs: DiscoveryPreferences = { interests: ["DevOps"] };
    const ranked = rankOpportunities([unrelated, devopsOpp], prefs);
    expect(ranked[0].opportunity._id).toBe("devops");
  });

  it("canonical location 'Bengaluru' matches Bengaluru opportunities", () => {
    const bengOpp = makeOpp({
      _id: "beng",
      title: "Software Intern",
      location: "Bengaluru, Karnataka",
    });
    const usOpp = makeOpp({
      _id: "us",
      title: "Software Intern",
      location: "San Francisco, USA",
    });
    const prefs: DiscoveryPreferences = { location: "Bengaluru" };
    const ranked = rankOpportunities([usOpp, bengOpp], prefs);
    expect(ranked[0].opportunity._id).toBe("beng");
  });
});

// ── Anti-arbitrary-value: taxonomy size constraints ────────────────────────

describe("taxonomy integrity", () => {
  it("every skill has a non-empty id and label", () => {
    for (const entry of SKILL_TAXONOMY) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.id).not.toContain(" ");
    }
  });

  it("every interest has a non-empty id and label", () => {
    for (const entry of INTEREST_TAXONOMY_ENTRIES) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.id).not.toContain(" ");
    }
  });

  it("every location has a non-empty id and label", () => {
    for (const entry of LOCATION_TAXONOMY) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.id).not.toContain(" ");
    }
  });

  it("no duplicate IDs in skills", () => {
    const ids = SKILL_TAXONOMY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no duplicate IDs in interests", () => {
    const ids = INTEREST_TAXONOMY_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no duplicate IDs in locations", () => {
    const ids = LOCATION_TAXONOMY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── SearchableMultiSelect: previously failing searches now resolve ─────────

describe("SearchableMultiSelect gap coverage", () => {
  it("searching 'Data Annotation' finds the entry", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "data annotation");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("data-annotation");
  });

  it("searching 'qa' finds Quality Assurance", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "qa");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "quality-assurance")).toBe(true);
  });

  it("searching 'testing' finds Quality Assurance", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "testing");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "quality-assurance")).toBe(true);
  });

  it("searching 'backend' finds Backend Development", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "backend");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "backend-development")).toBe(true);
  });

  it("searching 'full stack' finds Full Stack Development", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "full stack");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "full-stack-development")).toBe(true);
  });

  it("searching 'frontend' finds Frontend Development", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "frontend");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "frontend-development")).toBe(true);
  });

  it("searching 'embedded' finds Embedded Systems", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "embedded");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "embedded-systems")).toBe(true);
  });

  it("searching 'iot' finds Embedded Systems", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "iot");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "embedded-systems")).toBe(true);
  });

  it("searching 'devops' in skills finds DevOps", () => {
    const results = searchTaxonomy(SKILL_TAXONOMY, "devops");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "devops")).toBe(true);
  });

  it("searching 'game dev' in interests finds Game Dev", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "game dev");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "game-dev")).toBe(true);
  });

  it("searching 'data analytics' finds Data Analytics interest", () => {
    const results = searchTaxonomy(INTEREST_TAXONOMY_ENTRIES, "data analytics");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "data-analytics")).toBe(true);
  });

  it("searching 'mobile dev' in skills finds Mobile Development", () => {
    const results = searchTaxonomy(SKILL_TAXONOMY, "mobile dev");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "mobile-development")).toBe(true);
  });

  it("searching 'cloud computing' in skills finds Cloud", () => {
    const results = searchTaxonomy(SKILL_TAXONOMY, "cloud computing");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.id === "cloud")).toBe(true);
  });
});
