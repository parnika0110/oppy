import { describe, it, expect } from "vitest";
import { isImageUrl, isLowQualityImageUrl } from "../images";

describe("image URL validation", () => {
  it("accepts valid image URLs", () => {
    expect(isImageUrl("https://example.com/photo.jpg")).toBe(true);
    expect(isImageUrl("https://example.com/image.png")).toBe(true);
    expect(isImageUrl("https://cdn.example.com/event-cover.webp")).toBe(true);
    expect(isImageUrl("https://images.unsplash.com/photo-123")).toBe(true);
  });

  it("rejects null and empty", () => {
    expect(isImageUrl("")).toBe(false);
    expect(isImageUrl(null as any)).toBe(false);
    expect(isImageUrl(undefined as any)).toBe(false);
  });

  it("rejects HTML pages", () => {
    expect(isImageUrl("https://example.com/page.html")).toBe(false);
    expect(isImageUrl("https://example.com/page.htm")).toBe(false);
  });

  it("rejects favicons", () => {
    expect(isImageUrl("https://example.com/favicon.ico")).toBe(false);
    expect(isImageUrl("https://example.com/favicon.png")).toBe(false);
    expect(isImageUrl("https://example.com/apple-touch-icon.png")).toBe(false);
  });

  it("rejects generic platform images", () => {
    expect(isImageUrl("https://eventbrite.com/static/images/logo.png")).toBe(false);
    expect(isImageUrl("https://github.com/identicons/project.png")).toBe(false);
    expect(isImageUrl("https://linkedin.com/mpr/mpr/image.jpg")).toBe(false);
  });

  it("rejects auth/login pages", () => {
    expect(isImageUrl("https://example.com/login")).toBe(false);
    expect(isImageUrl("https://example.com/signup")).toBe(false);
  });

  it("accepts GitHub repository images", () => {
    expect(isImageUrl("https://raw.githubusercontent.com/user/repo/main/image.png")).toBe(true);
    expect(isImageUrl("https://user-images.githubusercontent.com/123/image.png")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isImageUrl("not-a-url")).toBe(false);
  });

  it("handles protocol-relative URLs", () => {
    // Protocol-relative URLs are valid when used with a base
    // but new URL() requires a base, so these fail parsing
    expect(isImageUrl("//example.com/image.jpg")).toBe(false);
  });
});

describe("isLowQualityImageUrl", () => {
  it("rejects tiny logos and icons", () => {
    expect(isLowQualityImageUrl("https://example.com/logo.png")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/icon16.png")).toBe(true);
    expect(isLowQualityImageUrl("https://cdn.co/logo32.jpg")).toBe(true);
  });

  it("rejects size-parameter URLs", () => {
    expect(isLowQualityImageUrl("https://example.com/img.jpg?width=32")).toBe(true);
    expect(isLowQualityImageUrl("https://example.com/img.jpg?w=64")).toBe(true);
  });

  it("rejects logo files with underscores", () => {
    expect(isLowQualityImageUrl("https://www.gstatic.com/hiring/CportalUi/google_logo_dark.png")).toBe(true);
    expect(isLowQualityImageUrl("https://cdn.co/logo_foo.png")).toBe(true);
  });

  it("rejects logo directory paths", () => {
    expect(isLowQualityImageUrl("https://internshala-uploads.internshala.com/logo%2Fbiuykoo16hd.jpg")).toBe(true);
  });

  it("does NOT reject high-quality images", () => {
    expect(isLowQualityImageUrl("https://cdn.example.com/cover.jpg")).toBe(false);
    expect(isLowQualityImageUrl("https://images.unsplash.com/photo-123")).toBe(false);
    expect(isLowQualityImageUrl("https://example.com/event-banner.png")).toBe(false);
  });

  it("does NOT reject high-quality OG images with logo in filename", () => {
    // outreachy-logo-open-graph-1200x1200 is a large OG image, not a tiny logo
    expect(isLowQualityImageUrl("https://www.outreachy.org/static/outreachy-logo-open-graph-1200x1200.png")).toBe(false);
  });

  it("handles edge cases", () => {
    expect(isLowQualityImageUrl("")).toBe(false);
    expect(isLowQualityImageUrl(null as any)).toBe(false);
  });
});
