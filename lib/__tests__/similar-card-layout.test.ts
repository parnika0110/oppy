import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("Similar Opportunities — grid layout", () => {
  const similarCode = readFileSync("components/SimilarOpportunities.tsx", "utf8");

  it("grid uses items-start to prevent card stretching", () => {
    // Both the loading skeleton grid and the actual items grid must have items-start
    const gridMatches = similarCode.match(/grid grid-cols-[^"]*items-start/g);
    expect(gridMatches).not.toBeNull();
    expect(gridMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("loading skeleton grid has items-start", () => {
    expect(similarCode).toContain("items-start");
  });

  it("renders 4-column grid on large screens", () => {
    expect(similarCode).toContain("lg:grid-cols-4");
  });

  it("renders 2-column grid on small screens", () => {
    expect(similarCode).toContain("sm:grid-cols-2");
  });

  it("renders 1-column grid on mobile", () => {
    expect(similarCode).toContain("grid-cols-1");
  });
});

describe("Similar Opportunities — card variant structure", () => {
  const cardCode = readFileSync("components/OpportunityCard.tsx", "utf8");

  it("similar variant uses 16:9 aspect ratio for thumbnails", () => {
    // Find the similar variant image container
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).toContain("aspectRatio: '16/9'");
  });

  it("similar variant does NOT use mt-auto for CTA", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).not.toContain("mt-auto");
  });

  it("similar variant does NOT render tags", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).not.toContain("tags.map");
    expect(similarSection).not.toContain("sms-chip");
  });

  it("similar variant does NOT render Save/Share buttons", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).not.toContain("SaveButton");
    expect(similarSection).not.toContain("ShareButton");
  });

  it("similar variant does NOT render metadata strip (stipend/duration)", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).not.toContain("stipend");
    expect(similarSection).not.toContain("duration");
    expect(similarSection).not.toContain("deadline");
  });

  it("similar variant limits title to 2 lines", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).toContain("line-clamp-2");
  });

  it("similar variant limits location to 1 line", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).toContain("line-clamp-1");
  });

  it("similar variant outer wrapper has flex-col for natural height", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).toContain("flex flex-col");
  });

  it("similar variant Link has flex-col for natural height", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).toContain("className=\"group flex flex-col\"");
  });
});

describe("Detail page — tracker placement", () => {
  const detailCode = readFileSync("app/opportunity/[id]/page.tsx", "utf8");

  it("DetailTracker is NOT in absolute hero overlay", () => {
    // The old code had DetailTracker inside an absolute bottom-4 container
    // over the hero image. This should be removed.
    const heroSection = detailCode.substring(
      detailCode.indexOf("DetailImage"),
      detailCode.indexOf("Content")
    );
    expect(heroSection).not.toContain("DetailTracker");
  });

  it("DetailTracker is rendered in the content section", () => {
    expect(detailCode).toContain("DetailTracker opportunityId={opp._id}");
  });

  it("DetailTracker is placed before the CTA button", () => {
    const trackerIdx = detailCode.indexOf("DetailTracker opportunityId={opp._id}");
    const ctaIdx = detailCode.indexOf("CTA Button");
    expect(trackerIdx).toBeLessThan(ctaIdx);
  });

  it("DetailTracker is NOT inside the hero image container", () => {
    // Find the absolute overlay containers — there should be none for tracker
    const lines = detailCode.split("\n");
    let inHeroSection = false;
    let trackerInHero = false;
    for (const line of lines) {
      if (line.includes("DetailImage")) inHeroSection = false;
      if (line.includes("className") && line.includes("absolute") && line.includes("hero")) inHeroSection = true;
      if (inHeroSection && line.includes("DetailTracker")) trackerInHero = true;
    }
    expect(trackerInHero).toBe(false);
  });
});
