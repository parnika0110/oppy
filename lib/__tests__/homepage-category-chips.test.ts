import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const landingCode = readFileSync("components/LandingPage.tsx", "utf8");

// The browse/filter system matches canonical singular category values
// (Internship, Hackathon, Job, ...). The homepage quick-filter chips must
// link with those values, not the plural display labels.
const EXPECTED_CANONICAL_HREFS = [
  "/?category=Internship",
  "/?category=Hackathon",
  "/?category=Job",
  "/?category=Fellowship",
  "/?category=Scholarship",
  "/?category=Event",
  "/?category=Grant",
];

describe("homepage category chips — canonical links", () => {
  it("never links plural category values", () => {
    for (const plural of [
      "category=Internships",
      "category=Hackathons",
      "category=Jobs",
      "category=Fellowships",
      "category=Scholarships",
      "category=Events",
      "category=Grants",
    ]) {
      expect(landingCode).not.toContain(`?${plural}`);
      expect(landingCode).not.toContain(`&${plural}`);
    }
  });

  it("links every category chip to its canonical singular value", () => {
    for (const href of EXPECTED_CANONICAL_HREFS) {
      expect(landingCode).toContain(`href: "${href}"`);
    }
  });

  it("keeps the plural display labels visible on the chips", () => {
    for (const label of [
      "Internships",
      "Hackathons",
      "Jobs",
      "Fellowships",
      "Scholarships",
      "Events",
      "Grants",
    ]) {
      expect(landingCode).toContain(`label: "${label}"`);
    }
  });

  it("maps the Open Source chip to the interests filter (not a category)", () => {
    expect(landingCode).toContain('href: "/?interests=Open%20Source"');
  });

  it("appends sort=recommended to every chip link", () => {
    const hrefs = landingCode.match(/href: "\/\?([^"]+)"/g) ?? [];
    expect(hrefs.length).toBeGreaterThanOrEqual(8);
    for (const href of hrefs) {
      expect(href).toMatch(/category=[A-Za-z]+|interests=Open/);
    }
  });
});