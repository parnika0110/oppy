import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const cardCode = readFileSync("components/OpportunityCard.tsx", "utf8");
const dashCode = readFileSync("app/dashboard/page.tsx", "utf8");
const savedCode = readFileSync("app/saved/page.tsx", "utf8");
const homeCode = readFileSync("app/page.tsx", "utf8");

const defaultSection = cardCode.substring(cardCode.indexOf("// ── Default card variant"));
const similarSection = cardCode.substring(
  cardCode.indexOf("if (isSimilar)"),
  cardCode.indexOf("// ── Default card variant")
);

describe("OpportunityCard — equal-height grid contract", () => {
  it("default card root stretches to fill its grid wrapper (flex-1)", () => {
    expect(defaultSection).toContain("flex flex-col overflow-hidden flex-1");
  });

  it("default card keeps flex-col + mt-auto CTA for bottom anchoring", () => {
    expect(defaultSection).toContain("flex flex-col");
    expect(defaultSection).toContain("mt-auto");
  });

  it("similar variant keeps natural height (no flex-1 growth)", () => {
    // The Similar Opportunities grid uses items-start + natural card heights.
    expect(similarSection).not.toContain("flex-1");
  });

  it("missing metadata does not shrink the card — content sits in a growing column", () => {
    // Metadata strip is optional (IIFE returns null when nothing present),
    // but the card column itself must still grow to the row height.
    expect(defaultSection).toContain("const hasStipend = Boolean(stipend)");
    expect(defaultSection).toContain("return null;");
  });
});

describe("Card grids — wrappers stretch cards to equal height", () => {
  it("dashboard Section wrapper is a flex column", () => {
    expect(dashCode).toContain('<div key={opp._id} className="relative flex flex-col">');
    expect(dashCode).toContain("<OpportunityCard opportunity={opp} />");
  });

  it("saved page wrapper is a flex column", () => {
    expect(savedCode).toContain('<div key={opp._id} className="relative flex flex-col">');
    expect(savedCode).toContain("<OpportunityCard opportunity={opp} />");
  });

  it("discovery grids wrap cards in flex columns", () => {
    const wrapperCount = (homeCode.match(/className="relative flex flex-col">/g) || []).length;
    expect(wrapperCount).toBeGreaterThanOrEqual(2);
  });

  it("traditional browse grid renders cards as direct stretched grid items", () => {
    // Cards as direct grid children rely on CSS grid's default align stretch.
    expect(homeCode).toContain('<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">');
  });
});
