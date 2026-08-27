import { describe, it, expect } from "vitest";
import { isLikelyImageUrl, isNotImageUrl } from "@/lib/image-validation";

describe("isLikelyImageUrl", () => {
  it("recognizes image file extensions", () => {
    expect(isLikelyImageUrl("https://example.com/photo.png")).toBe(true);
    expect(isLikelyImageUrl("https://example.com/photo.jpg")).toBe(true);
    expect(isLikelyImageUrl("https://example.com/photo.jpeg")).toBe(true);
    expect(isLikelyImageUrl("https://example.com/photo.webp")).toBe(true);
    expect(isLikelyImageUrl("https://example.com/photo.gif")).toBe(true);
  });

  it("recognizes known image CDNs", () => {
    expect(isLikelyImageUrl("https://images.unsplash.com/photo-123")).toBe(true);
    expect(isLikelyImageUrl("https://example.datocms-assets.com/img.jpg")).toBe(true);
  });

  it("rejects non-http URLs", () => {
    expect(isLikelyImageUrl("")).toBe(false);
    expect(isLikelyImageUrl("not-a-url")).toBe(false);
  });

  it("rejects HTML pages", () => {
    expect(isLikelyImageUrl("https://example.com/page.html")).toBe(false);
    expect(isLikelyImageUrl("https://example.com/page.php")).toBe(false);
  });
});

describe("isNotImageUrl", () => {
  it("identifies HTML pages", () => {
    expect(isNotImageUrl("https://example.com/page.html")).toBe(true);
    expect(isNotImageUrl("https://example.com/page.php")).toBe(true);
  });

  it("identifies favicons", () => {
    expect(isNotImageUrl("https://example.com/favicon.ico")).toBe(true);
    expect(isNotImageUrl("https://example.com/favicon.png")).toBe(true);
  });

  it("identifies HN item pages", () => {
    expect(isNotImageUrl("https://news.ycombinator.com/item?id=12345")).toBe(true);
  });

  it("identifies search URLs", () => {
    expect(isNotImageUrl("https://linkedin.com/jobs/search?q=python")).toBe(true);
  });

  it("does not flag valid image URLs", () => {
    expect(isNotImageUrl("https://example.com/photo.png")).toBe(false);
    expect(isNotImageUrl("https://images.unsplash.com/photo-123")).toBe(false);
  });

  it("rejects empty/null URLs", () => {
    expect(isNotImageUrl("")).toBe(true);
    expect(isNotImageUrl(null as any)).toBe(true);
  });

  it("rejects non-http URLs", () => {
    expect(isNotImageUrl("ftp://example.com/img.png")).toBe(true);
  });
});
