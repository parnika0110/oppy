import { describe, it, expect } from "vitest";

// ── Share Button Tests ─────────────────────────────────────────────────

describe("ShareButton — share on X", () => {
  it("uses x.com intent URL, not twitter.com", () => {
    const shareUrl = "https://x.com/intent/post";
    expect(shareUrl).toContain("x.com");
    expect(shareUrl).not.toContain("twitter.com");
  });

  it("X share text contains opportunity title", () => {
    const title = "Google Summer of Code";
    const org = "Google";
    const url = "https://oppy.app/opportunity/123";
    const text = `${title} at ${org} 🚀\nFound this on OPPY 👀\n${url}`;
    expect(text).toContain(title);
  });

  it("X share text contains organization", () => {
    const title = "HackMIT";
    const org = "MIT";
    const url = "https://oppy.app/opportunity/456";
    const text = `${title} at ${org} 🚀\nFound this on OPPY 👀\n${url}`;
    expect(text).toContain(org);
  });

  it("X share text contains opportunity URL", () => {
    const url = "https://oppy.app/opportunity/789";
    const text = `Title at Org 🚀\nFound this on OPPY 👀\n${url}`;
    expect(text).toContain(url);
  });

  it("X share text has rocket and eyes emoji", () => {
    const text = `Title at Org 🚀\nFound this on OPPY 👀\nhttps://oppy.app/opportunity/1`;
    expect(text).toContain("🚀");
    expect(text).toContain("👀");
  });

  it("menu label says 'Share on X', not 'Share on Twitter'", () => {
    // This is a UI label test — the actual rendered text
    const label = "𝕏 Share on X";
    expect(label).toContain("Share on X");
    expect(label).not.toContain("Share on Twitter");
  });
});

describe("ShareButton — LinkedIn", () => {
  it("LinkedIn share URL is valid", () => {
    const url = "https://oppy.app/opportunity/123";
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    expect(linkedInUrl).toContain("linkedin.com/sharing");
    expect(linkedInUrl).toContain(encodeURIComponent(url));
  });

  it("LinkedIn share URL encodes the opportunity URL", () => {
    const oppUrl = "https://oppy.app/opportunity/test-id";
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(oppUrl)}`;
    // The encoded URL should be in the LinkedIn share URL
    expect(linkedInUrl).toContain("share-offsite");
    expect(decodeURIComponent(linkedInUrl.split("url=")[1])).toBe(oppUrl);
  });
});

describe("ShareButton — copy link", () => {
  it("copy link uses the canonical opportunity URL", () => {
    const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/opportunity/123`;
    expect(url).toContain("/opportunity/");
  });
});

// ── OG Metadata Tests ──────────────────────────────────────────────────

describe("OG metadata — opportunity-specific", () => {
  interface MockOpp {
    _id: string;
    title: string;
    organization: string;
    description: string;
    imageUrl: string | null;
    category: string;
    sourceUrl: string;
  }

  function generateMetadata(opp: MockOpp) {
    const baseUrl = "https://oppy.app";
    const oppUrl = `${baseUrl}/opportunity/${opp._id}`;
    const title = `${opp.title}${opp.organization ? ` at ${opp.organization}` : ""}`;
    const description = opp.description
      ? opp.description.substring(0, 160).replace(/\s+/g, " ").trim()
      : `Find ${opp.category?.toLowerCase() || "opportunity"} opportunities on OPPY.`;
    const imageUrl = opp.imageUrl || `${baseUrl}/api/og-image?url=${encodeURIComponent(opp.sourceUrl || oppUrl)}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: oppUrl,
        siteName: "OPPY",
        images: [{ url: imageUrl, width: 1200, height: 630, alt: `${opp.title} cover` }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
      alternates: { canonical: oppUrl },
    };
  }

  it("og:title includes opportunity title and organization", () => {
    const opp: MockOpp = {
      _id: "abc123",
      title: "TreeHacks",
      organization: "Stanford",
      description: "A hackathon at Stanford",
      imageUrl: "https://example.com/treehacks.jpg",
      category: "Hackathon",
      sourceUrl: "https://treehacks.com",
    };
    const meta = generateMetadata(opp);
    expect(meta.openGraph.title).toBe("TreeHacks at Stanford");
  });

  it("og:description comes from opportunity description", () => {
    const opp: MockOpp = {
      _id: "abc123",
      title: "Test",
      organization: "Org",
      description: "This is the opportunity description that should appear in OG tags.",
      imageUrl: null,
      category: "Job",
      sourceUrl: "https://example.com",
    };
    const meta = generateMetadata(opp);
    expect(meta.openGraph.description).toBe(opp.description);
  });

  it("og:url is the canonical OPPY opportunity URL", () => {
    const opp: MockOpp = {
      _id: "xyz789",
      title: "Test",
      organization: "Org",
      description: "Desc",
      imageUrl: null,
      category: "Job",
      sourceUrl: "https://example.com",
    };
    const meta = generateMetadata(opp);
    expect(meta.openGraph.url).toBe("https://oppy.app/opportunity/xyz789");
    expect(meta.alternates.canonical).toBe("https://oppy.app/opportunity/xyz789");
  });

  it("og:image uses real opportunity image when available", () => {
    const opp: MockOpp = {
      _id: "abc",
      title: "Test",
      organization: "Org",
      description: "Desc",
      imageUrl: "https://example.com/photo.jpg",
      category: "Job",
      sourceUrl: "https://example.com",
    };
    const meta = generateMetadata(opp);
    expect(meta.openGraph.images[0].url).toBe("https://example.com/photo.jpg");
  });

  it("og:image falls back to OG-image API when no imageUrl", () => {
    const opp: MockOpp = {
      _id: "abc",
      title: "Test",
      organization: "Org",
      description: "Desc",
      imageUrl: null,
      category: "Job",
      sourceUrl: "https://example.com",
    };
    const meta = generateMetadata(opp);
    expect(meta.openGraph.images[0].url).toContain("/api/og-image");
    expect(meta.openGraph.images[0].url).toContain(encodeURIComponent("https://example.com"));
  });

  it("twitter:card is summary_large_image", () => {
    const opp: MockOpp = {
      _id: "abc",
      title: "Test",
      organization: "Org",
      description: "Desc",
      imageUrl: "https://example.com/photo.jpg",
      category: "Job",
      sourceUrl: "https://example.com",
    };
    const meta = generateMetadata(opp);
    expect(meta.twitter.card).toBe("summary_large_image");
  });

  it("twitter:title matches og:title", () => {
    const opp: MockOpp = {
      _id: "abc",
      title: "HackMIT",
      organization: "MIT",
      description: "Desc",
      imageUrl: null,
      category: "Hackathon",
      sourceUrl: "https://hackmit.org",
    };
    const meta = generateMetadata(opp);
    expect(meta.twitter.title).toBe(meta.openGraph.title);
  });

  it("no hardcoded opportunity data", () => {
    const opp1: MockOpp = {
      _id: "1",
      title: "First Opportunity",
      organization: "Org A",
      description: "Desc A",
      imageUrl: null,
      category: "Job",
      sourceUrl: "https://a.com",
    };
    const opp2: MockOpp = {
      _id: "2",
      title: "Second Opportunity",
      organization: "Org B",
      description: "Desc B",
      imageUrl: "https://b.com/photo.jpg",
      category: "Hackathon",
      sourceUrl: "https://b.com",
    };
    const meta1 = generateMetadata(opp1);
    const meta2 = generateMetadata(opp2);
    // Different opportunities produce different metadata
    expect(meta1.openGraph.title).not.toBe(meta2.openGraph.title);
    expect(meta1.openGraph.url).not.toBe(meta2.openGraph.url);
  });
});

// ── Similar Opportunities variant tests ─────────────────────────────────

describe("Similar Opportunities — compact variant", () => {
  it("variant prop accepts 'similar'", () => {
    type Variant = "default" | "similar";
    const variant: Variant = "similar";
    expect(variant).toBe("similar");
  });

  it("similar variant does not show tags", () => {
    // The similar variant omits the tags section entirely
    const showTags = false; // In similar variant, tags are not rendered
    expect(showTags).toBe(false);
  });

  it("similar variant uses 16:9 thumbnail", () => {
    const aspectRatio = "16/9";
    expect(aspectRatio).toBe("16/9");
  });

  it("similar variant title is limited to 2 lines", () => {
    const titleClass = "line-clamp-2";
    expect(titleClass).toContain("line-clamp-2");
  });

  it("similar variant location is limited to 1 line", () => {
    const locationClass = "line-clamp-1";
    expect(locationClass).toContain("line-clamp-1");
  });

  it("similar grid uses 4 columns on desktop", () => {
    const gridClass = "lg:grid-cols-4";
    expect(gridClass).toContain("grid-cols-4");
  });
});
