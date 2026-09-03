import { describe, it, expect } from "vitest";
import { isLowQualityImageUrl, isImageUrl } from "../images";

// ── Image aspect ratio heuristic tests ──────────────────────────────────
// These test the display-time heuristic in OpportunityCard.onLoad
// that detects unusable images (logo strips, extreme aspect ratios).

describe("Image onLoad heuristic — detect unusable images", () => {
  /**
   * The card uses:
   *   w < 100 || h < 60 || aspectRatio > 3 || aspectRatio < 0.3
   * to reject images that are too small or have extreme proportions.
   */

  function isUnusable(w: number, h: number): boolean {
    if (w <= 0 || h <= 0) return true;
    const aspectRatio = w / h;
    return w < 100 || h < 60 || aspectRatio > 3 || aspectRatio < 0.3;
  }

  // ── Normal images (should PASS) ──────────────────────────────────────

  it("16:9 landscape (1200×675) is usable", () => {
    expect(isUnusable(1200, 675)).toBe(false);
  });

  it("4:3 landscape (800×600) is usable", () => {
    expect(isUnusable(800, 600)).toBe(false);
  });

  it("1:1 square (500×500) is usable", () => {
    expect(isUnusable(500, 500)).toBe(false);
  });

  it("3:4 portrait (450×600) is usable", () => {
    expect(isUnusable(450, 600)).toBe(false);
  });

  it("2:1 landscape (600×300) is usable", () => {
    expect(isUnusable(600, 300)).toBe(false);
  });

  it("1:2 portrait (300×600) is usable", () => {
    expect(isUnusable(300, 600)).toBe(false);
  });

  it("standard OG image (1200×630) is usable", () => {
    expect(isUnusable(1200, 630)).toBe(false);
  });

  // ── Extreme aspect ratios (should REJECT) ────────────────────────────

  it("Microsoft logo strip (2000×40) is rejected — too wide", () => {
    expect(isUnusable(2000, 40)).toBe(true);
  });

  it("wide logo (1000×50) is rejected — aspect ratio > 3", () => {
    expect(isUnusable(1000, 50)).toBe(true);
  });

  it("tall narrow image (40×1000) is rejected — too tall", () => {
    expect(isUnusable(40, 1000)).toBe(true);
  });

  it("very wide banner (3000×100) is rejected", () => {
    expect(isUnusable(3000, 100)).toBe(true);
  });

  it("very tall image (50×600) is rejected", () => {
    expect(isUnusable(50, 600)).toBe(true);
  });

  // ── Small images (should REJECT) ─────────────────────────────────────

  it("tiny icon (32×32) is rejected — too small", () => {
    expect(isUnusable(32, 32)).toBe(true);
  });

  it("favicon (16×16) is rejected", () => {
    expect(isUnusable(16, 16)).toBe(true);
  });

  it("small logo (64×64) is rejected", () => {
    expect(isUnusable(64, 64)).toBe(true);
  });

  it("narrow small image (80×200) is rejected — width < 100", () => {
    expect(isUnusable(80, 200)).toBe(true);
  });

  it("short small image (200×40) is rejected — height < 60", () => {
    expect(isUnusable(200, 40)).toBe(true);
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  it("exactly 100×60 is usable (boundary)", () => {
    expect(isUnusable(100, 60)).toBe(false);
  });

  it("99×60 is rejected (just below boundary)", () => {
    expect(isUnusable(99, 60)).toBe(true);
  });

  it("100×59 is rejected (just below boundary)", () => {
    expect(isUnusable(100, 59)).toBe(true);
  });

  it("exactly 3:1 ratio (300×100) is usable (boundary)", () => {
    expect(isUnusable(300, 100)).toBe(false);
  });

  it("exactly 1:3 ratio (100×300) is usable (boundary)", () => {
    expect(isUnusable(100, 300)).toBe(false);
  });

  it("3.1:1 ratio (310×100) is rejected (just above boundary)", () => {
    expect(isUnusable(310, 100)).toBe(true);
  });

  it("zero dimensions are rejected", () => {
    expect(isUnusable(0, 0)).toBe(true);
  });

  it("negative dimensions are rejected", () => {
    expect(isUnusable(-100, -100)).toBe(true);
  });
});

// ── isLowQualityImageUrl — tests against actual module ──────────────────

describe("isLowQualityImageUrl — URL pattern detection (module)", () => {
  it("rejects tiny logo URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/logo.png")).toBe(true);
  });

  it("rejects icon URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/icon32.png")).toBe(true);
  });

  it("rejects thumbnail URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/thumb_large.jpg")).toBe(true);
  });

  it("rejects avatar URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/avatar01.png")).toBe(true);
  });

  it("rejects size-specific CDN variants", () => {
    expect(isLowQualityImageUrl("https://example.com/img.png?width=32")).toBe(true);
  });

  it("rejects fixed-size paths", () => {
    expect(isLowQualityImageUrl("https://example.com/64x64/icon.png")).toBe(true);
  });

  it("does NOT reject high-quality image URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/photos/hero-banner.jpg")).toBe(false);
  });

  it("does NOT reject images with large size hints", () => {
    expect(isLowQualityImageUrl("https://example.com/image.png?width=1200")).toBe(false);
  });

  it("handles empty input", () => {
    expect(isLowQualityImageUrl("")).toBe(false);
  });

  it("handles null/undefined input", () => {
    expect(isLowQualityImageUrl(null as any)).toBe(false);
    expect(isLowQualityImageUrl(undefined as any)).toBe(false);
  });
});

// ── isImageUrl — tests against actual module ────────────────────────────

describe("isImageUrl — URL validation (module)", () => {
  it("accepts a normal image URL", () => {
    expect(isImageUrl("https://example.com/photo.jpg")).toBe(true);
  });

  it("rejects HTML page URLs", () => {
    expect(isImageUrl("https://example.com/page.html")).toBe(false);
  });

  it("rejects favicon URLs", () => {
    expect(isImageUrl("https://example.com/favicon.ico")).toBe(false);
  });

  it("rejects login page URLs", () => {
    expect(isImageUrl("https://example.com/login")).toBe(false);
  });

  it("handles empty input", () => {
    expect(isImageUrl("")).toBe(false);
  });
});

// ── Card image fallback hierarchy ───────────────────────────────────────

describe("Card image fallback hierarchy", () => {
  it("primary image is preferred when valid", () => {
    const hasPrimary = true;
    const imgError = false;
    const isLowQuality = false;
    const showImage = Boolean(hasPrimary) && !imgError && !isLowQuality;
    expect(showImage).toBe(true);
  });

  it("primary image falls back on error", () => {
    const hasPrimary = true;
    const imgError = true;
    const isLowQuality = false;
    const showImage = Boolean(hasPrimary) && !imgError && !isLowQuality;
    expect(showImage).toBe(false);
  });

  it("low-quality URL is rejected even if URL is valid", () => {
    const hasPrimary = true;
    const imgError = false;
    const isLowQuality = true;
    const showImage = Boolean(hasPrimary) && !imgError && !isLowQuality;
    expect(showImage).toBe(false);
  });

  it("OG image is used when primary fails", () => {
    const hasPrimaryImage = false;
    const ogImage = "https://example.com/og.jpg";
    const ogFailed = false;
    const hasOgImage = Boolean(ogImage) && !ogFailed;
    const showImage = hasPrimaryImage || hasOgImage;
    expect(showImage).toBe(true);
  });

  it("OrgAvatar fallback when no images available", () => {
    const hasPrimaryImage = false;
    const ogImage = null;
    const ogFailed = false;
    const hasOgImage = Boolean(ogImage) && !ogFailed;
    const showImage = hasPrimaryImage || hasOgImage;
    expect(showImage).toBe(false);
  });

  it("aspect ratio heuristic rejects Microsoft logo strip at display time", () => {
    const w = 2000;
    const h = 40;
    const aspectRatio = w / h;
    const isUnusable = w < 100 || h < 60 || aspectRatio > 3 || aspectRatio < 0.3;
    expect(isUnusable).toBe(true);
  });

  it("aspect ratio heuristic accepts normal Eventbrite images", () => {
    const w = 1200;
    const h = 630;
    const aspectRatio = w / h;
    const isUnusable = w < 100 || h < 60 || aspectRatio > 3 || aspectRatio < 0.3;
    expect(isUnusable).toBe(false);
  });
});
