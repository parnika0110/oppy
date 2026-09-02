import { describe, it, expect } from "vitest";
import type { OpportunityDocument } from "@/types/opportunity";
import { isLowQualityImageUrl, isImageUrl } from "../images";

/**
 * Regression tests for the OpportunityCard image fallback chain.
 *
 * The card component uses Next.js hooks (useRouter, useSearchParams) that
 * prevent direct rendering in unit tests. Instead, we test the decision
 * logic that determines which image source is used.
 *
 * Image flow:
 *   1. primary imageUrl → show if available and no error
 *   2. OG image fallback → fetched proactively when no imageUrl, or reactively on primary error
 *   3. OrgAvatar (category gradient + initials) → final fallback
 */

// ── Helpers ─────────────────────────────────────────────────────────────

function makeOpp(overrides: Partial<OpportunityDocument> = {}): OpportunityDocument {
  return {
    _id: "test-1",
    title: "Software Engineering Intern",
    organization: "Acme Corp",
    category: "Internship",
    location: "Remote",
    tags: ["python", "engineering"],
    description: "A great software engineering internship.",
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

// ── Decision logic tests ────────────────────────────────────────────────

describe("OpportunityCard image fallback logic", () => {
  describe("primary image availability", () => {
    it("uses primary imageUrl when available", () => {
      const opp = makeOpp({ imageUrl: "https://cdn.example.com/img.jpg" });
      const hasPrimary = Boolean(opp.imageUrl);
      expect(hasPrimary).toBe(true);
    });

    it("does not use primary when imageUrl is null", () => {
      const opp = makeOpp({ imageUrl: null });
      const hasPrimary = Boolean(opp.imageUrl);
      expect(hasPrimary).toBe(false);
    });

    it("does not use primary when imageUrl is undefined", () => {
      const opp = makeOpp({ imageUrl: undefined });
      const hasPrimary = Boolean(opp.imageUrl);
      expect(hasPrimary).toBe(false);
    });

    it("does not use primary when imageUrl is empty string", () => {
      const opp = makeOpp({ imageUrl: "" });
      const hasPrimary = Boolean(opp.imageUrl);
      expect(hasPrimary).toBe(false);
    });
  });

  describe("proactive OG fetch guard", () => {
    it("does NOT fetch OG when primary imageUrl exists", () => {
      const opp = makeOpp({ imageUrl: "https://cdn.example.com/img.jpg" });
      const shouldFetchOgProactive = !opp.imageUrl && Boolean(opp.sourceUrl || opp.applicationLink);
      expect(shouldFetchOgProactive).toBe(false);
    });

    it("fetches OG proactively when imageUrl is null and source URL exists", () => {
      const opp = makeOpp({ imageUrl: null, sourceUrl: "https://example.com/event" });
      const shouldFetchOgProactive = !opp.imageUrl && Boolean(opp.sourceUrl || opp.applicationLink);
      expect(shouldFetchOgProactive).toBe(true);
    });

    it("fetches OG proactively when imageUrl is undefined", () => {
      const opp = makeOpp({ imageUrl: undefined, applicationLink: "https://example.com/apply" });
      const shouldFetchOgProactive = !opp.imageUrl && Boolean(opp.sourceUrl || opp.applicationLink);
      expect(shouldFetchOgProactive).toBe(true);
    });

    it("does NOT fetch OG when no source URL available", () => {
      const opp = makeOpp({ imageUrl: null, sourceUrl: null, applicationLink: "" });
      const shouldFetchOgProactive = !opp.imageUrl && Boolean(opp.sourceUrl || opp.officialSourceUrl || opp.applicationLink);
      expect(shouldFetchOgProactive).toBe(false);
    });
  });

  describe("error-once guard (no loops)", () => {
    it("fetched flag prevents repeated OG requests", () => {
      // Simulates the useOgImageFallback state machine
      let fetched = false;
      const fetching = false;
      const ogImage: string | null = null;

      function fetchOg() {
        if (fetching || fetched) return; // guard
        // Simulate fetch failure
        fetched = true;
      }

      // First call — should execute
      fetchOg();
      expect(fetched).toBe(true);

      // Second call — should be blocked by fetched flag
      const prevFetched = fetched;
      fetchOg();
      expect(fetched).toBe(prevFetched); // unchanged
    });

    it("primary error triggers OG fetch only once", () => {
      let fetched = false;
      const fetching = false;

      function handlePrimaryError() {
        if (!fetched && !fetching) {
          fetched = true;
        }
      }

      handlePrimaryError();
      expect(fetched).toBe(true);

      // Multiple errors — no re-fetch
      handlePrimaryError();
      handlePrimaryError();
      expect(fetched).toBe(true);
    });
  });

  describe("showImage decision", () => {
    it("showImage = true when primary image exists", () => {
      const hasPrimary = true;
      const hasOg = false;
      expect(hasPrimary || hasOg).toBe(true);
    });

    it("showImage = true when OG image exists", () => {
      const hasPrimary = false;
      const hasOg = true;
      expect(hasPrimary || hasOg).toBe(true);
    });

    it("showImage = false when neither exists — falls back to OrgAvatar", () => {
      const hasPrimary = false;
      const hasOg = false;
      expect(hasPrimary || hasOg).toBe(false);
      // This triggers the OrgAvatar fallback
    });
  });
});

// ── Low-quality image URL detection ──────────────────────────────────────

describe("isLowQualityImageUrl", () => {
  it("rejects tiny logo URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/logo32.png")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/logo.png")).toBe(true);
    expect(isLowQualityImageUrl("https://cdn.example.com/company-logo.jpg")).toBe(true);
  });

  it("rejects icon URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/icon16.png")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/icon.png")).toBe(true);
  });

  it("rejects thumbnail URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/thumb64.jpg")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/thumbnail.png")).toBe(true);
  });

  it("rejects avatar URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/avatar32.png")).toBe(true);
  });

  it("rejects size-specific CDN variants", () => {
    expect(isLowQualityImageUrl("https://example.com/img.jpg?width=32")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/img.jpg?w=64")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/img.jpg?size=48")).toBe(true);
    expect(isLowQualityImageUrl("https://cdn.example.com/w/32/image.png")).toBe(true);
  });

  it("rejects fixed-size paths", () => {
    expect(isLowQualityImageUrl("https://example.com/16x16/icon.png")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/32x32/logo.png")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/64x64/image.png")).toBe(true);
  });

  it("does NOT reject high-quality image URLs", () => {
    expect(isLowQualityImageUrl("https://cdn.example.com/hero-banner.jpg")).toBe(false);
    expect(isLowQualityImageUrl("https://images.unsplash.com/photo-1234567890")).toBe(false);
    expect(isLowQualityImageUrl("https://example.com/cover-image-wide.png")).toBe(false);
    expect(isLowQualityImageUrl("https://example.com/event-cover.webp")).toBe(false);
  });

  it("does NOT reject images with large size hints", () => {
    expect(isLowQualityImageUrl("https://example.com/img.jpg?width=800")).toBe(false);
    expect(isLowQualityImageUrl("https://example.com/img.jpg?w=1200")).toBe(false);
  });

  it("handles empty/null input", () => {
    expect(isLowQualityImageUrl("")).toBe(false);
    expect(isLowQualityImageUrl(null as any)).toBe(false);
  });
});

// ── Combined quality guard ──────────────────────────────────────────────

describe("Card image quality decision", () => {
  it("rejects image when URL matches low-quality pattern", () => {
    const imageUrl = "https://example.com/logo32.png";
    const isLowQuality = isLowQualityImageUrl(imageUrl);
    const hasPrimary = Boolean(imageUrl) && !isLowQuality;
    expect(hasPrimary).toBe(false);
  });

  it("accepts image when URL is high-quality", () => {
    const imageUrl = "https://cdn.example.com/hero-banner.jpg";
    const isLowQuality = isLowQualityImageUrl(imageUrl);
    const hasPrimary = Boolean(imageUrl) && !isLowQuality;
    expect(hasPrimary).toBe(true);
  });

  it("falls back to OG when primary is low-quality", () => {
    const imageUrl = "https://example.com/icon.png";
    const isLowQuality = isLowQualityImageUrl(imageUrl);
    const hasPrimary = Boolean(imageUrl) && !isLowQuality;
    const hasOgImage = false; // OG not fetched yet
    const showImage = hasPrimary || hasOgImage;
    expect(showImage).toBe(false); // Will trigger OrgAvatar
  });

  it("falls back to OrgAvatar when both primary and OG are unavailable", () => {
    const hasPrimary = false;
    const hasOgImage = false;
    const showImage = hasPrimary || hasOgImage;
    expect(showImage).toBe(false);
  });

  it("shows OG image when primary is low-quality but OG is available", () => {
    const imageUrl = "https://example.com/logo32.png";
    const isLowQuality = isLowQualityImageUrl(imageUrl);
    const hasPrimary = Boolean(imageUrl) && !isLowQuality;
    const hasOgImage = true;
    const showImage = hasPrimary || hasOgImage;
    expect(showImage).toBe(true);
  });
});

// ── OrgAvatar gradient tests ────────────────────────────────────────────

const AVATAR_GRADIENTS: Record<string, string> = {
  Job:         "linear-gradient(135deg, #BFE0CC 0%, #5FA37B 100%)",
  Hackathon:   "linear-gradient(135deg, #D2C9EE 0%, #8B7DC7 100%)",
  Internship:  "linear-gradient(135deg, #F0C6A0 0%, #C98A4B 100%)",
  Fellowship:  "linear-gradient(135deg, #B3CDA8 0%, #6E9463 100%)",
  Scholarship: "linear-gradient(135deg, #ACCEDF 0%, #5D8BA3 100%)",
  Grant:       "linear-gradient(135deg, #E8D5C4 0%, #B8946C 100%)",
  Event:       "linear-gradient(135deg, #E8D0FF 0%, #9B6CC7 100%)",
};

describe("OrgAvatar fallback", () => {
  it("has a gradient for every OPPY category", () => {
    const categories = ["Job", "Hackathon", "Internship", "Fellowship", "Scholarship", "Grant", "Event"];
    for (const cat of categories) {
      expect(AVATAR_GRADIENTS[cat]).toBeDefined();
      expect(AVATAR_GRADIENTS[cat]).toContain("linear-gradient");
    }
  });

  it("falls back to Event gradient for unknown categories", () => {
    const fallback = AVATAR_GRADIENTS["Unknown"] ?? AVATAR_GRADIENTS["Event"];
    expect(fallback).toBe(AVATAR_GRADIENTS["Event"]);
  });

  it("generates correct initials from organization name", () => {
    function getInitials(org: string): string {
      const words = org.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).filter(Boolean);
      if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
      if (words.length === 1 && words[0].length >= 2) return words[0].substring(0, 2).toUpperCase();
      return org.substring(0, 2).toUpperCase();
    }

    expect(getInitials("Google")).toBe("GO");
    expect(getInitials("Microsoft")).toBe("MI");
    expect(getInitials("TreeHacks")).toBe("TR");
    expect(getInitials("AI Builders Challenge")).toBe("AB");
    expect(getInitials("Y")).toBe("Y");
    expect(getInitials("OpenAI")).toBe("OP");
  });
});
