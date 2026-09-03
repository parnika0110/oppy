import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

// ── 1. Meta University URL ──────────────────────────────────────────────────

describe("Meta University URL — must not be stale", () => {
  const staticCode = readFileSync("lib/ingestion/sources/static-programs.ts", "utf8");

  it("Meta University applicationLink is NOT the old 404 URL", () => {
    expect(staticCode).not.toContain(
      "metacareers.com/careerprograms/pathways/metauniversity"
    );
  });

  it("Meta University applicationLink uses the valid students page", () => {
    expect(staticCode).toContain(
      "metacareers.com/careerprograms/students/"
    );
  });

  it("Meta University record has correct organization field", () => {
    // The organization field should appear right after the title in the static catalog
    const titleLine = staticCode.indexOf('title: "Meta University Internship"');
    expect(titleLine).toBeGreaterThan(-1);
    const orgLine = staticCode.indexOf('organization: "Meta"', titleLine);
    expect(orgLine).toBeGreaterThan(titleLine);
    expect(orgLine - titleLine).toBeLessThan(200);
  });
});

// ── 2. Detail Page ShareButton ──────────────────────────────────────────────

describe("Opportunity detail page — ShareButton presence", () => {
  const detailCode = readFileSync("app/opportunity/[id]/page.tsx", "utf8");

  it("imports ShareButton", () => {
    expect(detailCode).toContain('import ShareButton from "@/components/ShareButton"');
  });

  it("renders ShareButton in the hero area", () => {
    expect(detailCode).toContain("<ShareButton");
  });

  it("ShareButton uses opportunity URL format /opportunity/${opp._id}", () => {
    expect(detailCode).toContain("/opportunity/${opp._id}");
  });

  it("ShareButton is next to SaveButton in a flex container", () => {
    // Both ShareButton and SaveButton should be in the same absolute container
    const shareIdx = detailCode.indexOf("<ShareButton");
    const saveIdx = detailCode.indexOf("<SaveButton", shareIdx);
    expect(saveIdx).toBeGreaterThan(shareIdx);
    expect(saveIdx - shareIdx).toBeLessThan(300);
  });
});

// ── 3. ShareButton URL — LinkedIn uses exact opportunity URL ─────────────────

describe("ShareButton — LinkedIn uses exact opportunity URL", () => {
  const shareCode = readFileSync("components/ShareButton.tsx", "utf8");

  it("LinkedIn share uses url prop, not a hardcoded URL", () => {
    expect(shareCode).toContain("encodeURIComponent(url)");
    expect(shareCode).not.toContain("localhost:3000/opportunity");
  });

  it("LinkedIn share URL goes to linkedin.com/sharing/share-offsite/", () => {
    expect(shareCode).toContain("linkedin.com/sharing/share-offsite/");
  });

  it("X share uses x.com, not twitter.com", () => {
    expect(shareCode).toContain("x.com/intent/post");
    expect(shareCode).not.toContain("twitter.com");
  });

  it("X share text includes OPPY branding", () => {
    expect(shareCode).toContain("Found this on OPPY");
  });

  it("button label says 'Share on X' not 'Share on Twitter'", () => {
    expect(shareCode).toContain("Share on X");
    expect(shareCode).not.toContain("Share on Twitter");
  });

  it("URL is the sole source for LinkedIn share — no fallback to homepage", () => {
    // The shareLinkedIn function should encode the url prop directly
    const linkedInFn = shareCode.substring(
      shareCode.indexOf("function shareLinkedIn"),
      shareCode.indexOf("setOpen(false)", shareCode.indexOf("shareLinkedIn"))
    );
    expect(linkedInFn).toContain("encodeURIComponent(url)");
    expect(linkedInFn).not.toContain("window.location.origin");
    expect(linkedInFn).not.toContain('"/"');
  });
});

// ── 4. OpportunityCard ShareButton — consistent visibility ───────────────────

describe("OpportunityCard — ShareButton is always rendered in default variant", () => {
  const cardCode = readFileSync("components/OpportunityCard.tsx", "utf8");

  it("default variant renders ShareButton", () => {
    // After the isSimilar early return, the default variant must have ShareButton
    const similarReturnIdx = cardCode.indexOf("if (isSimilar)");
    const defaultReturnIdx = cardCode.indexOf("return (", similarReturnIdx);
    const shareIdx = cardCode.indexOf("<ShareButton", defaultReturnIdx);
    expect(shareIdx).toBeGreaterThan(defaultReturnIdx);
  });

  it("ShareButton is absolutely positioned in the card header", () => {
    const shareIdx = cardCode.indexOf("<ShareButton");
    const beforeShare = cardCode.substring(shareIdx - 200, shareIdx);
    expect(beforeShare).toContain("absolute");
    expect(beforeShare).toContain("z-10");
  });

  it("ShareButton URL uses NEXT_PUBLIC_APP_URL", () => {
    const shareIdx = cardCode.indexOf("<ShareButton");
    const afterShare = cardCode.substring(shareIdx, shareIdx + 300);
    expect(afterShare).toContain("NEXT_PUBLIC_APP_URL");
    expect(afterShare).toContain("/opportunity/${opportunity._id}");
  });

  it("similar variant does NOT render ShareButton", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("if (isSimilar)") + 500
    );
    expect(similarSection).not.toContain("<ShareButton");
  });
});

// ── 5. DetailImage — compact fallback when no image ─────────────────────────

describe("DetailImage — compact fallback for missing images", () => {
  const imageCode = readFileSync("components/DetailImage.tsx", "utf8");

  it("uses 16/4 aspect ratio when no image (compact fallback)", () => {
    expect(imageCode).toContain("showImage ? '16/7' : '16/4'");
  });

  it("uses 16/7 aspect ratio when image is present", () => {
    expect(imageCode).toContain("16/7");
  });

  it("shows organization name in fallback", () => {
    expect(imageCode).toContain("opp.organization");
  });

  it("shows category in fallback", () => {
    expect(imageCode).toContain("opp.category");
  });

  it("initial letter avatar is smaller than original (12 vs 16)", () => {
    expect(imageCode).toContain("w-12 h-12");
    expect(imageCode).not.toMatch(/w-16 h-16(?!.*w-12)/);
  });
});

// ── 6. Stipend unit wrapping — non-breaking space ───────────────────────────

describe("Card metadata — stipend unit non-breaking", () => {
  const cardCode = readFileSync("components/OpportunityCard.tsx", "utf8");

  it("metadata columns use breakInside avoid", () => {
    const matches = cardCode.match(/breakInside:\s*'avoid'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2); // at least stipend + duration
  });

  it("metadata strip is data-driven (returns null when no metadata)", () => {
    expect(cardCode).toContain("if (!hasStipend && !hasDuration && !hasDeadline) return null");
  });

  it("does not fabricate placeholder values", () => {
    expect(cardCode).not.toContain('"N/A"');
    expect(cardCode).not.toContain('"Not specified"');
    expect(cardCode).not.toContain('"—"');
  });
});

// ── 7. Similar Opportunities — compact layout ───────────────────────────────

describe("Similar Opportunities — compact layout", () => {
  const similarCode = readFileSync("components/SimilarOpportunities.tsx", "utf8");

  it("grid uses items-start to prevent stretching", () => {
    const gridMatches = similarCode.match(/items-start/g);
    expect(gridMatches).not.toBeNull();
    expect(gridMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("does not render ShareButton in similar variant", () => {
    expect(similarCode).not.toContain("ShareButton");
  });
});

// ── 8. OG Metadata — opportunity-specific ───────────────────────────────────

describe("OG metadata — opportunity-specific generation", () => {
  const detailCode = readFileSync("app/opportunity/[id]/page.tsx", "utf8");

  it("generateMetadata exists", () => {
    expect(detailCode).toContain("export async function generateMetadata");
  });

  it("uses opportunity-specific title", () => {
    expect(detailCode).toContain("opp.title");
  });

  it("uses opportunity-specific URL as canonical", () => {
    expect(detailCode).toContain("canonical: oppUrl");
  });

  it("OG image falls back to /api/og-image when no imageUrl", () => {
    expect(detailCode).toContain("/api/og-image");
  });

  it("twitter card is summary_large_image", () => {
    expect(detailCode).toContain('card: "summary_large_image"');
  });
});
