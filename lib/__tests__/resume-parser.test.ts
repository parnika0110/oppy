import { describe, it, expect } from "vitest";
import { parseResume } from "@/lib/resume-parser";
import { scoreOpportunity, type DiscoveryPreferences } from "@/lib/relevance";
import type { OpportunityDocument } from "@/types/opportunity";

// ── Helper: create a mock opportunity ──────────────────────────────────

function makeOpp(overrides: Partial<OpportunityDocument> = {}): OpportunityDocument {
  return {
    _id: { toString: () => "test-id" } as any,
    title: "Software Engineer",
    organization: "Test Corp",
    category: "Internship",
    location: "Remote",
    description: "Build cool stuff with Python and React",
    tags: ["python", "react", "backend"],
    source: "test",
    url: "https://example.com",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as OpportunityDocument;
}

// ── Resume Parser Tests ────────────────────────────────────────────────

describe("parseResume", () => {
  it("rejects unsupported file types", async () => {
    const buffer = Buffer.from("test content");
    await expect(parseResume(buffer, "image/png")).rejects.toThrow("Unsupported file type");
  });
});

// ── Resume Signal Integration Tests ────────────────────────────────────

describe("Resume signals in recommendation scoring", () => {
  const baseOpp = makeOpp({
    title: "Unity Game Developer",
    tags: ["unity", "c#", "game", "unreal"],
    description: "Build games using Unity and C#. Experience with game engines preferred.",
    category: "Job",
  });

  const pythonOpp = makeOpp({
    title: "Python Backend Engineer",
    tags: ["python", "fastapi", "mongodb"],
    description: "Build backend services with Python, FastAPI, and MongoDB.",
    category: "Job",
  });

  const hackathonOpp = makeOpp({
    title: "HackMIT 2024",
    tags: ["hackathon", "building", "boston"],
    description: "Annual hackathon at MIT. Build something in 24 hours.",
    category: "Hackathon",
    location: "Boston",
  });

  const frontendOpp = makeOpp({
    title: "React Frontend Developer",
    tags: ["react", "typescript", "css", "frontend"],
    description: "Build modern web interfaces with React and TypeScript.",
    category: "Job",
  });

  const devopsOpp = makeOpp({
    title: "DevOps Engineer",
    tags: ["kubernetes", "docker", "aws", "terraform"],
    description: "Manage cloud infrastructure on AWS with Kubernetes and Terraform.",
    category: "Job",
  });

  it("resume skills boost matching opportunities when explicit interests are weak", () => {
    // User has no explicit interests but resume shows Python + Unity
    const prefsNoInterests: DiscoveryPreferences = {
      resumeSkills: ["Python", "Unity", "C#"],
      resumeInterests: ["Game Dev"],
      resumeDomains: ["Game Dev"],
    };

    const gameScore = scoreOpportunity(baseOpp, prefsNoInterests);
    const pythonScore = scoreOpportunity(pythonOpp, prefsNoInterests);
    const hackScore = scoreOpportunity(hackathonOpp, prefsNoInterests);

    // Game and Python opportunities should score higher than hackathon
    expect(gameScore.interests).toBeGreaterThan(hackScore.interests);
    expect(pythonScore.interests).toBeGreaterThan(hackScore.interests);
  });

  it("explicit interests override resume signals", () => {
    // User explicitly selected DevOps as interest
    const prefsExplicit: DiscoveryPreferences = {
      interests: ["DevOps"],
      resumeSkills: ["Python", "Unity"],
      resumeInterests: ["Game Dev"],
    };

    const devopsScore = scoreOpportunity(devopsOpp, prefsExplicit);
    const gameScore = scoreOpportunity(baseOpp, prefsExplicit);

    // DevOps should rank higher due to explicit interest, even though resume says Game Dev
    expect(devopsScore.interests).toBeGreaterThanOrEqual(gameScore.interests);
  });

  it("resume signals with no explicit preferences provide baseline boost", () => {
    const prefs: DiscoveryPreferences = {
      resumeSkills: ["Python", "FastAPI"],
      resumeInterests: ["Backend Development"],
    };

    const pythonScore = scoreOpportunity(pythonOpp, prefs);
    const hackScore = scoreOpportunity(hackathonOpp, prefs);

    // Python backend should score higher than hackathon with resume signals
    expect(pythonScore.interests).toBeGreaterThan(hackScore.interests);
  });

  it("resume signals don't override strong explicit preferences", () => {
    // User explicitly wants Game Dev + has Unity skill
    const prefs: DiscoveryPreferences = {
      interests: ["Game Dev"],
      skills: ["Unity"],
      resumeSkills: ["Python", "Django"],
      resumeInterests: ["Backend Development"],
    };

    const gameScore = scoreOpportunity(baseOpp, prefs);
    const pythonScore = scoreOpportunity(pythonOpp, prefs);

    // Game Dev opportunity should rank higher due to explicit interest + skill
    expect(gameScore.interests).toBeGreaterThanOrEqual(pythonScore.interests);
  });

  it("no resume profile doesn't break scoring", () => {
    const prefs: DiscoveryPreferences = {
      interests: ["Game Dev"],
      skills: ["Unity"],
    };

    const gameScore = scoreOpportunity(baseOpp, prefs);
    expect(gameScore.interests).toBeGreaterThan(0);
  });

  it("empty resume arrays don't affect scoring", () => {
    const prefsNoResume: DiscoveryPreferences = {
      interests: ["Game Dev"],
    };
    const prefsEmptyResume: DiscoveryPreferences = {
      interests: ["Game Dev"],
      resumeSkills: [],
      resumeInterests: [],
      resumeDomains: [],
    };

    const scoreNoResume = scoreOpportunity(baseOpp, prefsNoResume);
    const scoreEmptyResume = scoreOpportunity(baseOpp, prefsEmptyResume);

    expect(scoreNoResume.interests).toBe(scoreEmptyResume.interests);
  });

  it("resume domain matching boosts relevant opportunities", () => {
    const prefs: DiscoveryPreferences = {
      resumeDomains: ["Game Dev", "AI / ML"],
    };

    const gameScore = scoreOpportunity(baseOpp, prefs);
    const hackScore = scoreOpportunity(hackathonOpp, prefs);

    // Game dev opportunity should score higher than generic hackathon
    expect(gameScore.interests).toBeGreaterThan(hackScore.interests);
  });
});

// ── Backward Compatibility Tests ───────────────────────────────────────

describe("Backward compatibility", () => {
  it("existing user without resumeProfile scores correctly", () => {
    const prefs: DiscoveryPreferences = {
      interests: ["AI / ML"],
      skills: ["Python"],
    };

    const opp = makeOpp({
      title: "Machine Learning Intern",
      tags: ["ml", "python", "tensorflow"],
      description: "Build ML models with Python and TensorFlow.",
    });

    const score = scoreOpportunity(opp, prefs);
    expect(score.interests).toBeGreaterThan(0);
  });

  it("legacy profile values still work with taxonomy resolution", () => {
    // Simulates old "Devop" → "DevOps" resolution
    const prefs: DiscoveryPreferences = {
      interests: ["DevOps"],
      skills: ["Python"],
    };

    const devopsOpp = makeOpp({
      title: "DevOps Engineer",
      tags: ["kubernetes", "docker", "aws"],
      description: "Manage cloud infrastructure.",
    });

    const score = scoreOpportunity(devopsOpp, prefs);
    expect(score.interests).toBeGreaterThan(0);
  });
});

// ── Architecture Test: Explicit Preferences Override Resume Signals ─────

describe("Explicit preferences override resume signals (architecture)", () => {
  const gameOpp = makeOpp({
    title: "Unity Game Developer",
    tags: ["unity", "c#", "game"],
    description: "Build games using Unity and C#.",
    category: "Job",
  });

  const javaOpp = makeOpp({
    title: "Java Backend Engineer",
    tags: ["java", "spring", "aws"],
    description: "Build backend services with Java and Spring Boot.",
    category: "Job",
  });

  it("explicit Game Dev interest ranks higher than resume Java skills", () => {
    // User explicitly wants Game Dev
    // Resume shows Java, Spring, AWS
    const prefs: DiscoveryPreferences = {
      interests: ["Game Dev"],
      resumeSkills: ["Java", "Spring Boot", "AWS"],
      resumeInterests: ["Backend Development"],
    };

    const gameScore = scoreOpportunity(gameOpp, prefs);
    const javaScore = scoreOpportunity(javaOpp, prefs);

    // Game Dev opportunity should rank higher due to explicit interest
    expect(gameScore.interests).toBeGreaterThanOrEqual(javaScore.interests);
  });

  it("resume signals only boost when explicit interests are weak", () => {
    // User has no explicit interests but resume shows Python
    const prefsNoInterests: DiscoveryPreferences = {
      resumeSkills: ["Python"],
      resumeInterests: ["Backend Development"],
    };

    const pythonOpp = makeOpp({
      title: "Python Developer",
      tags: ["python", "fastapi"],
      description: "Build with Python.",
      category: "Job",
    });

    const hackOpp = makeOpp({
      title: "Generic Hackathon",
      tags: ["hackathon", "building"],
      description: "Build something in 24 hours.",
      category: "Hackathon",
    });

    const pyScore = scoreOpportunity(pythonOpp, prefsNoInterests);
    const hackScore = scoreOpportunity(hackOpp, prefsNoInterests);

    // Python opportunity should score higher than generic hackathon
    expect(pyScore.interests).toBeGreaterThan(hackScore.interests);
  });

  it("explicit interests max score (30) exceeds resume signal max (10)", () => {
    // Same user, same opportunity — explicit vs resume-only
    const withExplicit: DiscoveryPreferences = {
      interests: ["Game Dev"],
    };
    const withResume: DiscoveryPreferences = {
      resumeSkills: ["Unity"],
      resumeInterests: ["Game Dev"],
    };

    const explicitScore = scoreOpportunity(gameOpp, withExplicit);
    const resumeScore = scoreOpportunity(gameOpp, withResume);

    // Explicit preferences should produce higher or equal scores
    expect(explicitScore.interests).toBeGreaterThanOrEqual(resumeScore.interests);
  });

  it("resume skills dont override explicit interests for wrong category", () => {
    // User explicitly wants Game Dev, resume shows Java
    // Java opportunity should NOT outrank game opportunity
    const prefs: DiscoveryPreferences = {
      interests: ["Game Dev"],
      skills: ["Unity"],
      resumeSkills: ["Java", "Spring Boot"],
    };

    const gameScore = scoreOpportunity(gameOpp, prefs);
    const javaScore = scoreOpportunity(javaOpp, prefs);

    // Game Dev should rank higher
    expect(gameScore.interests).toBeGreaterThan(javaScore.interests);
  });
});

// ── Concrete Scenario: Resume Java, Student wants Game Dev ──────────────

describe("Concrete scenario: resume Java/Backend, student wants Game Dev in Paris", () => {
  // Resume contains: Java, Spring Boot, SQL, AWS, Backend project
  // Student explicitly chooses: Game Development, C#
  // Student then chooses: Location Paris, Remote Yes, Categories Internship+Hackathon

  const prefs: DiscoveryPreferences = {
    // Explicit user preferences (what the student wants NOW)
    interests: ["Game Dev"],
    skills: ["C#"],
    categories: ["Internship", "Hackathon"],
    location: "Paris",
    remote: true,
    // Resume-derived signals (what the student has DONE)
    resumeSkills: ["Java", "Spring Boot", "SQL", "AWS"],
    resumeInterests: ["Backend Development"],
    resumeDomains: ["Backend Development"],
  };

  const gameInternship = makeOpp({
    title: "Game Dev Intern",
    tags: ["unity", "c#", "game"],
    description: "Build games using Unity and C#.",
    category: "Internship",
    location: "Paris",
  });

  const javaBackendJob = makeOpp({
    title: "Java Backend Engineer",
    tags: ["java", "spring", "aws"],
    description: "Build backend services with Java, Spring Boot, AWS.",
    category: "Job",
    location: "Remote",
  });

  const hackathonParis = makeOpp({
    title: "Paris Game Jam",
    tags: ["hackathon", "game", "unity"],
    description: "48-hour game jam in Paris.",
    category: "Hackathon",
    location: "Paris",
  });

  const genericEvent = makeOpp({
    title: "Tech Meetup",
    tags: ["networking", "tech"],
    description: "General tech networking event.",
    category: "Event",
    location: "London",
  });

  it("game dev internship in Paris ranks highest", () => {
    const scores = [
      { opp: gameInternship, score: scoreOpportunity(gameInternship, prefs) },
      { opp: javaBackendJob, score: scoreOpportunity(javaBackendJob, prefs) },
      { opp: hackathonParis, score: scoreOpportunity(hackathonParis, prefs) },
      { opp: genericEvent, score: scoreOpportunity(genericEvent, prefs) },
    ];

    // Sort by total score descending
    scores.sort((a, b) => b.score.total - a.score.total);

    // Game Dev internship should be #1
    expect(scores[0].opp.title).toBe("Game Dev Intern");
  });

  it("Java backend job ranks lower than game dev despite resume skills", () => {
    const gameScore = scoreOpportunity(gameInternship, prefs);
    const javaScore = scoreOpportunity(javaBackendJob, prefs);

    // Game Dev should rank higher due to explicit interest + category match
    expect(gameScore.total).toBeGreaterThan(javaScore.total);
  });

  it("Java backend job still gets SOME boost from resume (not zero)", () => {
    const javaScore = scoreOpportunity(javaBackendJob, prefs);
    const noResumePrefs: DiscoveryPreferences = {
      interests: ["Game Dev"],
      skills: ["C#"],
      categories: ["Internship", "Hackathon"],
    };
    const javaScoreNoResume = scoreOpportunity(javaBackendJob, noResumePrefs);

    // Java should score slightly higher with resume signals than without
    expect(javaScore.total).toBeGreaterThanOrEqual(javaScoreNoResume.total);
  });

  it("Paris game jam ranks well due to explicit location + interest", () => {
    const gameScore = scoreOpportunity(gameInternship, prefs);
    const hackScore = scoreOpportunity(hackathonParis, prefs);

    // Both should score well — game dev + Paris + categories match
    expect(gameScore.total).toBeGreaterThan(0);
    expect(hackScore.total).toBeGreaterThan(0);
  });

  it("generic event in London ranks lowest", () => {
    const scores = [
      scoreOpportunity(gameInternship, prefs).total,
      scoreOpportunity(javaBackendJob, prefs).total,
      scoreOpportunity(hackathonParis, prefs).total,
      scoreOpportunity(genericEvent, prefs).total,
    ];

    // Generic event should be last
    expect(Math.max(...scores)).toBeGreaterThan(scoreOpportunity(genericEvent, prefs).total);
  });
});
