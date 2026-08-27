import { describe, it, expect } from "vitest";
import { ENGLISH_FIXTURES, HINDI_FIXTURES, getFixture, getAllFixtureInputs } from "../sarvam/__mocks__/fixtures";
import { scoreOpportunity, getMatchLevel, rankOpportunities, type DiscoveryPreferences } from "../relevance";
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

describe("Sarvam mock fixtures", () => {
  describe("English fixtures", () => {
    it("remote AI internships fixture", () => {
      const fixture = getFixture("I want remote AI internships for students in India");
      expect(fixture).toBeDefined();
      expect(fixture!.expected.categories).toEqual(["Internship"]);
      expect(fixture!.expected.interests).toEqual(["AI / ML"]);
      expect(fixture!.expected.remote).toBe(true);
      expect(fixture!.expected.location).toBe("India");
      expect(fixture!.expected.experience).toBe("Student");
    });

    it("software engineering jobs fixture", () => {
      const fixture = getFixture("Find software engineering jobs in India");
      expect(fixture).toBeDefined();
      expect(fixture!.expected.categories).toEqual(["Job"]);
      expect(fixture!.expected.interests).toEqual(["Software Engineering"]);
      expect(fixture!.expected.location).toBe("India");
    });

    it("marketing internships fixture", () => {
      const fixture = getFixture("I want marketing internships");
      expect(fixture).toBeDefined();
      expect(fixture!.expected.categories).toEqual(["Internship"]);
      expect(fixture!.expected.interests).toEqual(["Marketing"]);
    });
  });

  describe("Hindi fixtures", () => {
    it("Hinglish remote AI internships fixture", () => {
      const fixture = getFixture("Bharat mein remote AI internships chahiye");
      expect(fixture).toBeDefined();
      expect(fixture!.expected.categories).toEqual(["Internship"]);
      expect(fixture!.expected.interests).toEqual(["AI / ML"]);
      expect(fixture!.expected.remote).toBe(true);
      expect(fixture!.expected.location).toBe("India");
    });
  });

  describe("All fixtures are loadable", () => {
    it("has English fixtures", () => {
      expect(ENGLISH_FIXTURES.length).toBeGreaterThan(5);
    });

    it("has Hindi fixtures", () => {
      expect(HINDI_FIXTURES.length).toBeGreaterThan(0);
    });

    it("getAllFixtureInputs returns all inputs", () => {
      const inputs = getAllFixtureInputs();
      expect(inputs.length).toBeGreaterThan(5);
      expect(inputs).toContain("I want remote AI internships for students in India");
    });
  });

  describe("Fixture-driven relevance scoring", () => {
    it("remote AI internships fixture ranks AI internships first", () => {
      const prefs: DiscoveryPreferences = {
        categories: ["Internship"],
        interests: ["AI / ML"],
        remote: true,
        location: "India",
        experience: "Student",
      };

      const aiIntern = makeOpp({
        _id: "ai-intern",
        title: "AI/ML Internship",
        category: "Internship",
        tags: ["ai", "machine learning", "python"],
        location: "Remote",
        isRemote: true,
      });

      const hrIntern = makeOpp({
        _id: "hr-intern",
        title: "HR Intern",
        category: "Internship",
        tags: ["human resources", "recruiting"],
        location: "Mumbai",
      });

      const ranked = rankOpportunities([hrIntern, aiIntern], prefs);
      expect(ranked[0].opportunity._id).toBe("ai-intern");
      expect(ranked[0].score.interests).toBeGreaterThan(0);
    });

    it("marketing internships fixture ranks marketing internships first", () => {
      const prefs: DiscoveryPreferences = {
        categories: ["Internship"],
        interests: ["Marketing"],
      };

      const marketingIntern = makeOpp({
        _id: "mkt-intern",
        title: "Digital Marketing Intern",
        category: "Internship",
        tags: ["marketing", "social media"],
      });

      const aiIntern = makeOpp({
        _id: "ai-intern",
        title: "AI/ML Internship",
        category: "Internship",
        tags: ["ai", "machine learning"],
      });

      const ranked = rankOpportunities([aiIntern, marketingIntern], prefs);
      expect(ranked[0].opportunity._id).toBe("mkt-intern");
    });

    it("software engineering jobs fixture ranks remote SW jobs first", () => {
      const prefs: DiscoveryPreferences = {
        categories: ["Job"],
        interests: ["Software Engineering"],
        location: "India",
      };

      const indiaSW = makeOpp({
        _id: "india-sw",
        title: "Software Engineer",
        category: "Job",
        tags: ["software engineering", "python"],
        location: "Bengaluru, India",
      });

      const usSW = makeOpp({
        _id: "us-sw",
        title: "Software Engineer",
        category: "Job",
        tags: ["software engineering"],
        location: "San Francisco, USA",
      });

      const ranked = rankOpportunities([usSW, indiaSW], prefs);
      expect(ranked[0].opportunity._id).toBe("india-sw");
    });

    it("hackathons + AI/ML fixture ranks AI hackathons first", () => {
      const prefs: DiscoveryPreferences = {
        categories: ["Hackathon"],
        interests: ["AI / ML", "Web Development"],
        location: "India",
      };

      const aiHack = makeOpp({
        _id: "ai-hack",
        title: "AI Hackathon",
        category: "Hackathon",
        tags: ["ai", "hackathon", "python"],
        location: "Bengaluru, India",
      });

      const designHack = makeOpp({
        _id: "design-hack",
        title: "Design Sprint",
        category: "Hackathon",
        tags: ["design", "figma"],
        location: "New York",
      });

      const ranked = rankOpportunities([designHack, aiHack], prefs);
      expect(ranked[0].opportunity._id).toBe("ai-hack");
    });
  });
});
