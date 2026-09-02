/**
 * OPPY Image Validation & Resolution Pipeline
 *
 * Validates image URLs, resolves OG images, and provides fallbacks.
 * Used during ingestion to ensure quality images are stored.
 *
 * Fallback order:
 *   1. Source-provided image
 *   2. JSON-LD image
 *   3. OG:image
 *   4. Twitter image
 *   5. Organization website image
 *   6. Gradient fallback (null — UI handles)
 */

import { URL } from "url";

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_WIDTH = 400;
const MIN_HEIGHT = 200;
const MAX_ASPECT_RATIO = 4; // width/height ratio
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

// Generic platform images that should NOT be used as opportunity images
const GENERIC_PLATFORM_PATTERNS = [
  "eventbrite.com/static/images/",
  "eventbrite.com/d/",
  "lu.ma/static/",
  "linkedin.com/mpr/",
  "internshala.com/images/",
  "github.com/identicons/",
  "github.com/favicon",
  "devpost.com/screenshot/",
  "devfolio.co/images/",
  "unstop.com/public/images/",
  "facebook.com/images/",
  "twitter.com/images/",
  "pbs.twimg.com/profile_",
];

// Favicon patterns
const FAVICON_PATTERNS = [
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon",
  "/favicon-",
  "apple-touch-icon",
  "favicon",
];

// Patterns indicating tiny/low-resolution images (logos, thumbnails, icons)
// These are typically 16-64px and not suitable for card display.
const LOW_QUALITY_PATTERNS = [
  // Logo/thumbnail size hints in URL path
  /[-\/]logo\d*\.(png|jpg|jpeg|svg|gif|webp)/i,
  /[-\/]icon\d*\.(png|jpg|jpeg|svg|gif|webp)/i,
  /[-\/]thumb\w*\.(png|jpg|jpeg|svg|gif|webp)/i,
  /[-\/]avatar\d*\.(png|jpg|jpeg|svg|gif|webp)/i,
  /[-\/]badge\d*\.(png|jpg|jpeg|svg|gif|webp)/i,
  // Size-specific CDN variants
  /\?.*(?:width|w|size|dim)=(?:\d{1,2}|[12]\d{2})\b/i, // width=16..199
  /[\/](?:w|h|size|dim)[=\/](?:\d{1,2}|[12]\d{2})\b/i,  // /w/32, /h/64
  // Common tiny image paths
  /[\/]16x16[\/]/i,
  /[\/]32x32[\/]/i,
  /[\/]48x48[\/]/i,
  /[\/]64x64[\/]/i,
  /[\/]favicon[\/]/i,
];

// Minimum dimensions for a usable card image (in pixels).
// Images smaller than this are rejected in favor of OG/avatar fallbacks.
export const MIN_IMAGE_WIDTH = 200;
export const MIN_IMAGE_HEIGHT = 100;

// ── Validation Functions ──────────────────────────────────────────────────

/**
 * Check if a URL looks like a low-resolution/tiny image (logo, icon, thumbnail).
 * Returns true if the URL pattern suggests the image is too small for card display.
 */
export function isLowQualityImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if a URL is plausibly an actual image (not HTML, favicon, etc.)
 */
export function isImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    // Reject HTML pages
    if (path.endsWith(".html") || path.endsWith(".htm")) return false;

    // Reject favicons
    if (FAVICON_PATTERNS.some(p => path.includes(p))) return false;

    // Reject generic platform images
    if (GENERIC_PLATFORM_PATTERNS.some(p => url.includes(p))) return false;

    // Reject images that are obviously not opportunity images
    if (path.includes("/login") || path.includes("/signup") || path.includes("/auth")) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a URL by checking HTTP status and content type.
 * Returns validation result without downloading the full image.
 */
export async function validateImageUrl(url: string): Promise<{
  valid: boolean;
  status: number;
  contentType: string;
  error?: string;
}> {
  try {
    const parsed = new URL(url);
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OPPYBot/1.0)",
        "Accept": "image/*",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";

    // Check for HTML response (probably a page, not an image)
    if (contentType.includes("text/html")) {
      return { valid: false, status: response.status, contentType, error: "HTML response" };
    }

    // Check for valid image content type
    if (contentType && !contentType.includes("image/") && !contentType.includes("application/octet-stream")) {
      return { valid: false, status: response.status, contentType, error: "Not an image" };
    }

    return {
      valid: response.ok,
      status: response.status,
      contentType,
    };
  } catch (err) {
    return {
      valid: false,
      status: 0,
      contentType: "",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Fetch OpenGraph image from a page URL.
 * Used as fallback when source image is missing or invalid.
 */
export async function fetchOpenGraphImage(
  pageUrl: string,
  timeoutMs: number = TIMEOUT_MS
): Promise<string | null> {
  try {
    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OPPYBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Try og:image first
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    if (ogMatch && ogMatch[1]) {
      const imgUrl = ogMatch[1];
      if (isImageUrl(imgUrl)) return imgUrl;
    }

    // Try twitter:image
    const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

    if (twitterMatch && twitterMatch[1]) {
      const imgUrl = twitterMatch[1];
      if (isImageUrl(imgUrl)) return imgUrl;
    }

    // Try JSON-LD image
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
          const data = JSON.parse(jsonStr);
          if (data.image) {
            const imgUrl = typeof data.image === "string" ? data.image : data.image.url;
            if (imgUrl && isImageUrl(imgUrl)) return imgUrl;
          }
        } catch { /* skip invalid JSON-LD */ }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the best available image for an opportunity.
 * Tries multiple sources in priority order.
 */
export async function resolveBestImage(
  sourceImageUrl: string | null | undefined,
  opportunityUrl: string | null | undefined
): Promise<string | null> {
  // 1. Source-provided image — validate AND check URL patterns
  if (sourceImageUrl && isImageUrl(sourceImageUrl) && !isLowQualityImageUrl(sourceImageUrl)) {
    const validation = await validateImageUrl(sourceImageUrl);
    if (validation.valid) return sourceImageUrl;
  }

  // 2. Try OG image from the opportunity page
  if (opportunityUrl) {
    const ogImage = await fetchOpenGraphImage(opportunityUrl);
    if (ogImage) return ogImage;
  }

  // 3. Return null — UI will use gradient fallback
  return null;
}

/**
 * Resolve image URL relative to a base URL.
 */
export function resolveImageUrl(raw: string | null | undefined, baseUrl: string): string | null {
  if (!raw) return null;

  // Already absolute
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  // Protocol-relative
  if (raw.startsWith("//")) return `https:${raw}`;

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}
