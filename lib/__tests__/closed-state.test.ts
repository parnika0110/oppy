import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const cardCode = readFileSync("components/OpportunityCard.tsx", "utf8");
const filtersCode = readFileSync("components/DiscoveryFilters.tsx", "utf8");

describe("OpportunityCard — closed state contract", () => {
  it("derives a closed flag from lifecycleStatus", () => {
    expect(cardCode).toContain(
      'opportunity.lifecycleStatus === "closed" || opportunity.lifecycleStatus === "archived"'
    );
  });

  it("renders a Closed badge on the default card instead of the NEW badge", () => {
    expect(cardCode).toContain("Closed");
    expect(cardCode).toContain(": isNew && (");
  });

  it("replaces the external Apply/Register CTA with muted Closed text", () => {
    expect(cardCode).toContain("isClosed ? (");
    expect(cardCode).toContain('"Closed"');
  });

  it("shows Closed for the similar-variant CTA label too", () => {
    const similarSection = cardCode.substring(
      cardCode.indexOf("if (isSimilar)"),
      cardCode.indexOf("// ── Default card variant")
    );
    expect(similarSection).toContain('isClosed ? "Closed" : ctaLabel');
  });
});

describe("DiscoveryFilters — public discovery hides closed by default", () => {
  it("no longer offers a 'Closed' checkbox in the public filter panel", () => {
    expect(filtersCode).not.toContain("showClosed");
  });
});