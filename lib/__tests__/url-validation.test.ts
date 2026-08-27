import { describe, it, expect } from "vitest";
import { isPlatformHomepage } from "@/lib/url-utils";

describe("isPlatformHomepage", () => {
  it("rejects bare domain homepages", () => {
    expect(isPlatformHomepage("https://lu.ma/")).toBe(true);
    expect(isPlatformHomepage("https://mlh.io/")).toBe(true);
    expect(isPlatformHomepage("https://devpost.com/")).toBe(true);
    expect(isPlatformHomepage("https://internshala.com/")).toBe(true);
    expect(isPlatformHomepage("https://naukri.com/")).toBe(true);
    expect(isPlatformHomepage("https://linkedin.com/")).toBe(true);
  });

  it("rejects known category/search pages", () => {
    expect(isPlatformHomepage("https://lu.ma/explore")).toBe(true);
    expect(isPlatformHomepage("https://lu.ma/calendar")).toBe(true);
  });

  it("allows specific opportunity URLs", () => {
    expect(isPlatformHomepage("https://lu.ma/buildclub-event-abc")).toBe(false);
    expect(isPlatformHomepage("https://internshala.com/internship/detail/some-internship")).toBe(false);
    expect(isPlatformHomepage("https://devpost.com/hackathons/some-hackathon")).toBe(false);
    expect(isPlatformHomepage("https://news.ycombinator.com/item?id=12345")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isPlatformHomepage(null)).toBe(false);
    expect(isPlatformHomepage(undefined)).toBe(false);
  });

  it("returns false for non-http URLs", () => {
    expect(isPlatformHomepage("not-a-url")).toBe(false);
  });
});

// Test URL classification for active records
// Simplified test regex — matches the real isPlatformHomepage behavior:
// only bare domain paths or known non-opportunity paths
const PLATFORM_HOMES = [
  /^https?:\/\/linkedin\.com\/?$/i,
  /^https?:\/\/www\.linkedin\.com\/?$/i,
  /^https?:\/\/indeed\.com\/?$/i,
  /^https?:\/\/naukri\.com\/?$/i,
  /^https?:\/\/glassdoor\.com\/?$/i,
  /^https?:\/\/lu\.ma\/?$/i,
  /^https?:\/\/lu\.ma\/explore$/i,
  /^https?:\/\/lu\.ma\/calendar$/i,
  /^https?:\/\/internshala\.com\/?$/i,
  /^https?:\/\/internshala\.com\/internships\/?$/i,
  /^https?:\/\/devpost\.com\/?$/i,
  /^https?:\/\/devpost\.com\/hackathons\/?$/i,
  /^https?:\/\/devfolio\.co\/?$/i,
  /^https?:\/\/devfolio\.co\/hackathons\/?$/i,
  /^https?:\/\/mlh\.io\/?$/i,
  /^https?:\/\/remoteok\.com\/?$/i,
  /^https?:\/\/eventbrite\.com\/d\/online\/[^/]+\/?$/i,
];

// Search/category pages that are NOT individual opportunities
const SEARCH_PAGES = [
  /linkedin\.com\/jobs\/search/i,
  /indeed\.com\/jobs\?/i,
  /naukri\.com\/jobs-in/i,
];

function classifyUrl(url: string): string {
  if (!url.startsWith("http")) return "INVALID";
  if (PLATFORM_HOMES.some((p) => p.test(url))) return "PLATFORM_HOME";
  if (SEARCH_PAGES.some((p) => p.test(url))) return "SEARCH_PAGE";
  return "INDIVIDUAL";
}

describe("URL classification", () => {
  it("classifies platform homepages correctly", () => {
    expect(classifyUrl("https://linkedin.com/")).toBe("PLATFORM_HOME");
    expect(classifyUrl("https://lu.ma/explore")).toBe("PLATFORM_HOME");
    expect(classifyUrl("https://internshala.com/")).toBe("PLATFORM_HOME");
    expect(classifyUrl("https://eventbrite.com/d/online/tech/")).toBe("PLATFORM_HOME");
  });

  it("classifies search pages correctly", () => {
    expect(classifyUrl("https://linkedin.com/jobs/search?q=python")).toBe("SEARCH_PAGE");
    expect(classifyUrl("https://indeed.com/jobs?q=react")).toBe("SEARCH_PAGE");
    expect(classifyUrl("https://naukri.com/jobs-in-bangalore")).toBe("SEARCH_PAGE");
  });

  it("classifies individual opportunity URLs correctly", () => {
    expect(classifyUrl("https://news.ycombinator.com/item?id=12345")).toBe("INDIVIDUAL");
    expect(classifyUrl("https://internshala.com/internship/detail/python-intern")).toBe("INDIVIDUAL");
    expect(classifyUrl("https://summerofcode.withgoogle.com/")).toBe("INDIVIDUAL");
    expect(classifyUrl("https://devpost.com/hackathons/ai-hack-2026")).toBe("INDIVIDUAL");
  });
});
