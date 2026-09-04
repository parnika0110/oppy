import { describe, it, expect } from "vitest";
import { parseSearchQuery, hasSearchSignals, type SearchIntent } from "@/lib/search-intent";
import { publicOpportunityFilter, buildCandidateFilter, textSearchClause } from "@/lib/opportunities";

function stripSignals(intent: SearchIntent) {
  return {
    categories: intent.categories,
    interests: intent.interests,
    remote: intent.remote,
    location: intent.location,
    experience: intent.experience,
    keywords: intent.keywords,
  };
}

describe("parseSearchQuery — natural-language browse search", () => {
  it("AI Internships in Bengaluru → Internship + AI / ML + Bengaluru, keyword ai", () => {
    expect(stripSignals(parseSearchQuery("AI Internships in Bengaluru"))).toEqual({
      categories: ["Internship"],
      interests: ["AI / ML"],
      remote: undefined,
      location: "Bengaluru",
      experience: undefined,
      keywords: ["ai"],
    });
  });

  it("AI jobs in Mumbai → Job + AI / ML + Mumbai", () => {
    expect(stripSignals(parseSearchQuery("AI jobs in Mumbai"))).toEqual({
      categories: ["Job"],
      interests: ["AI / ML"],
      remote: undefined,
      location: "Mumbai",
      experience: undefined,
      keywords: ["ai"],
    });
  });

  it("normalizes Bangalore → Bengaluru", () => {
    const intent = parseSearchQuery("AI jobs in Bangalore");
    expect(intent.location).toBe("Bengaluru");
    expect(intent.categories).toEqual(["Job"]);
    expect(intent.keywords).toEqual(["ai"]);
  });

  it("software engineering internships in Bengaluru → Internship + Bengaluru + software keywords", () => {
    expect(stripSignals(parseSearchQuery("software engineering internships in Bengaluru"))).toEqual({
      categories: ["Internship"],
      interests: ["Software Engineering"],
      remote: undefined,
      location: "Bengaluru",
      experience: undefined,
      keywords: ["software", "engineering"],
    });
  });

  it("remote AI internships → Internship + remote + AI / ML", () => {
    expect(stripSignals(parseSearchQuery("remote AI internships"))).toEqual({
      categories: ["Internship"],
      interests: ["AI / ML"],
      remote: true,
      location: undefined,
      experience: undefined,
      keywords: ["ai"],
    });
  });

  it("hackathons in India → Hackathon + India, no leftover keywords", () => {
    expect(stripSignals(parseSearchQuery("hackathons in India"))).toEqual({
      categories: ["Hackathon"],
      interests: undefined,
      remote: undefined,
      location: "India",
      experience: undefined,
      keywords: [],
    });
  });

  it("plain keyword 'Python' → no signals, keyword python", () => {
    expect(stripSignals(parseSearchQuery("Python"))).toEqual({
      categories: undefined,
      interests: undefined,
      remote: undefined,
      location: undefined,
      experience: undefined,
      keywords: ["python"],
    });
    expect(hasSearchSignals(parseSearchQuery("Python"))).toBe(false);
  });

  it("remote + country both preserved (remote jobs in India)", () => {
    expect(stripSignals(parseSearchQuery("remote jobs in India"))).toEqual({
      categories: ["Job"],
      interests: undefined,
      remote: true,
      location: "India",
      experience: undefined,
      keywords: [],
    });
  });

  it("brand keyword survives category extraction (Google internship 2026)", () => {
    const intent = parseSearchQuery("Google internship 2026");
    expect(intent.categories).toEqual(["Internship"]);
    expect(intent.keywords).toEqual(["google", "2026"]);
  });

  it("additional cities are recognized (marketing internships in Pune)", () => {
    const intent = parseSearchQuery("marketing internships in Pune");
    expect(intent.categories).toEqual(["Internship"]);
    expect(intent.location).toBe("Pune");
    expect(intent.keywords).toEqual(["marketing"]);
  });

  it("students → Student experience, no phantom location", () => {
    const intent = parseSearchQuery("internships for students");
    expect(intent.categories).toEqual(["Internship"]);
    expect(intent.experience).toBe("Student");
    expect(intent.location).toBeUndefined();
  });

  it("internships in Mumbai → Internship + Mumbai, no leftover keywords", () => {
    expect(stripSignals(parseSearchQuery("internships in Mumbai"))).toEqual({
      categories: ["Internship"],
      interests: undefined,
      remote: undefined,
      location: "Mumbai",
      experience: undefined,
      keywords: [],
    });
  });

  it("AI opportunities → AI / ML interest, generic noun not kept as keyword", () => {
    expect(stripSignals(parseSearchQuery("AI opportunities"))).toEqual({
      categories: undefined,
      interests: ["AI / ML"],
      remote: undefined,
      location: undefined,
      experience: undefined,
      keywords: ["ai"],
    });
  });

  it("no recognized structured terms stays a pure keyword query", () => {
    const intent = parseSearchQuery("Outreachy summer 2026");
    expect(hasSearchSignals(intent)).toBe(false);
    expect(intent.keywords).toEqual(["outreachy", "summer", "2026"]);
  });

  it("handles punctuation on NL queries", () => {
    const intent = parseSearchQuery("AI internships in Bengaluru!");
    expect(intent.categories).toEqual(["Internship"]);
    expect(intent.location).toBe("Bengaluru");
    expect(intent.keywords).toEqual(["ai"]);
  });

  it("handles mixed casing", () => {
    const intent = parseSearchQuery("REMOTE AI INTERNSHIPS");
    expect(intent.remote).toBe(true);
    expect(intent.categories).toEqual(["Internship"]);
    expect(intent.keywords).toEqual(["ai"]);
  });

  it("deduplicates repeated words in keywords", () => {
    const intent = parseSearchQuery("python python internships");
    expect(intent.categories).toEqual(["Internship"]);
    expect(intent.keywords).toEqual(["python"]);
  });

  it("hasSearchSignals is true when a category is extracted", () => {
    expect(hasSearchSignals(parseSearchQuery("AI Internships in Bengaluru"))).toBe(true);
  });
});

describe("q tokenization in Mongo filters", () => {
  it("multi-word q becomes AND of per-term text clauses (not a literal phrase)", () => {
    const filter = publicOpportunityFilter({ q: "ai jobs in mumbai", showClosed: false });
    const clauses = (filter as any).$and;
    const searchClause = clauses.find((c: any) => c.$and && Array.isArray(c.$and) && c.$and.length === 4 && c.$and.every((t: any) => t.$or?.length === 4));
    expect(searchClause).toBeDefined();
    // The whole phrase must never be used as a literal regex
    const allRegex = JSON.stringify(filter);
    expect(allRegex).not.toContain("ai jobs in mumbai");
    // Each of the four terms present
    for (const term of ["ai", "jobs", "in", "mumbai"]) {
      expect(allRegex).toContain(term);
    }
  });

  it("single-word q keeps the historical single $or clause shape", () => {
    const filter = publicOpportunityFilter({ q: "python", showClosed: false });
    const clauses = (filter as any).$and;
    const searchClause = clauses.find((c: any) => c.$or?.length === 4);
    expect(searchClause).toBeDefined();
    expect(JSON.stringify(searchClause)).toContain("python");
  });

  it("candidate filter tokenizes q the same way", () => {
    const filter = buildCandidateFilter({ categories: ["Internship"], q: "ai internships bengaluru" });
    const clauses = (filter as any).$and;
    const categoryClause = clauses.find((c: any) => c.category);
    expect(categoryClause.category).toBe("Internship");
    const searchClause = clauses.find((c: any) => c.$and && c.$and.every((t: any) => t.$or?.length === 4));
    expect(searchClause).toBeDefined();
  });

  it("textSearchClause returns a plain object for empty input", () => {
    expect(textSearchClause("  ")).toEqual({});
  });

  it("escapes regex-special characters in terms", () => {
    const clause = textSearchClause("c++");
    expect(JSON.stringify(clause)).not.toContain("c++");
  });

  it("strips edge punctuation from keyword terms", () => {
    const clause = textSearchClause("python,") as any;
    const regex = JSON.stringify(clause);
    expect(regex).toContain("python");
    expect(regex).not.toContain("python,");
  });

  it("splits parenthesised and question-marked phrases into clean terms", () => {
    const clause = textSearchClause("(AI) machine learning?") as any;
    const terms = JSON.stringify(clause);
    expect(terms).toContain("AI");
    expect(terms).toContain("learning");
    expect(terms).not.toContain("learning?");
    expect(terms).not.toContain("(AI)");
  });

  it("keeps internal language symbols (C++, c#) intact", () => {
    const json = JSON.stringify(textSearchClause("C++ c#"));
    // JSON text contains C\\+\\+ (regex-escaped plus signs, doubled by JSON)
    expect(json).toContain("C\\\\+\\\\+");
    expect(json).toContain("c#");
  });

  it("returns no clause for punctuation-only input", () => {
    expect(textSearchClause("... ???")).toEqual({});
  });
});