/**
 * Image validation and resolution utilities.
 *
 * - validateImageUrl: check if a URL resolves to a usable image
 * - resolveOgImage: fetch og:image from a page with caching
 * - isLikelyImageUrl: quick check if URL looks like an image
 */

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i;

/** Quick heuristic: does this URL look like it could be an image? */
export function isLikelyImageUrl(url: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  if (IMAGE_EXTENSIONS.test(url)) return true;
  // URLs from known image CDNs
  if (url.includes("images.unsplash.com")) return true;
  if (url.includes("datocms-assets.com")) return true;
  if (url.includes("cloudinary.com")) return true;
  if (url.includes("img.shields.io")) return true;
  return false;
}

/** Check if a URL is NOT an image (HTML page, favicon, etc.) */
export function isNotImageUrl(url: string): boolean {
  if (!url) return true;
  if (!url.startsWith("http")) return true;
  // HTML pages
  if (/\.(html?|php|aspx?)(\?|$)/i.test(url)) return true;
  // Favicons
  if (/favicon|\.ico(\?|$)/i.test(url)) return true;
  // HN item pages
  if (url.includes("news.ycombinator.com/item?id=")) return true;
  // Common non-image patterns
  if (/\/search\?|\/jobs\?|\/q=/i.test(url)) return true;
  return false;
}

/**
 * Validate an image URL by making a HEAD request.
 * Returns { valid, contentType, statusCode } or null on failure.
 */
export async function validateImageUrl(
  url: string,
  timeoutMs: number = 3000
): Promise<{ valid: boolean; contentType?: string; statusCode?: number } | null> {
  if (!url || !url.startsWith("http") || isNotImageUrl(url)) {
    return { valid: false };
  }

  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });

    if (!res.ok) return { valid: false, statusCode: res.status };

    const ct = res.headers.get("content-type") || "";
    const valid = ct.includes("image") || ct.includes("octet-stream") || ct === "";
    return { valid, contentType: ct, statusCode: res.status };
  } catch {
    return null; // timeout or network error
  }
}

// Simple in-memory cache for OG images
const ogCache = new Map<string, string | null>();
const OG_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const ogCacheTimestamps = new Map<string, number>();

/**
 * Fetch og:image from a page URL with caching.
 * Returns the image URL or null.
 */
export async function resolveOgImage(
  pageUrl: string,
  timeoutMs: number = 5000
): Promise<string | null> {
  if (!pageUrl || !pageUrl.startsWith("http")) return null;

  // Check cache
  const cached = ogCache.get(pageUrl);
  const cachedAt = ogCacheTimestamps.get(pageUrl) || 0;
  if (cached !== undefined && Date.now() - cachedAt < OG_CACHE_TTL) {
    return cached;
  }

  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });

    if (!res.ok) {
      ogCache.set(pageUrl, null);
      ogCacheTimestamps.set(pageUrl, Date.now());
      return null;
    }

    const html = await res.text();
    const resolvedUrl = res.url || pageUrl;

    // Extract og:image
    const ogMatch =
      html.match(/<meta\s+(?:[^>]*?)property=["']og:image["'][^>]*?content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+(?:[^>]*?)content=["']([^"']+)["'][^>]*?property=["']og:image["']/i);

    if (ogMatch?.[1]) {
      const imgUrl = resolveRelativeUrl(ogMatch[1], resolvedUrl);
      if (imgUrl && !isNotImageUrl(imgUrl)) {
        ogCache.set(pageUrl, imgUrl);
        ogCacheTimestamps.set(pageUrl, Date.now());
        return imgUrl;
      }
    }

    // Try twitter:image
    const twMatch =
      html.match(/<meta\s+(?:[^>]*?)(?:name|property)=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+(?:[^>]*?)content=["']([^"']+)["'][^>]*?(?:name|property)=["']twitter:image["']/i);

    if (twMatch?.[1]) {
      const imgUrl = resolveRelativeUrl(twMatch[1], resolvedUrl);
      if (imgUrl && !isNotImageUrl(imgUrl)) {
        ogCache.set(pageUrl, imgUrl);
        ogCacheTimestamps.set(pageUrl, Date.now());
        return imgUrl;
      }
    }

    ogCache.set(pageUrl, null);
    ogCacheTimestamps.set(pageUrl, Date.now());
    return null;
  } catch {
    ogCache.set(pageUrl, null);
    ogCacheTimestamps.set(pageUrl, Date.now());
    return null;
  }
}

/** Resolve a potentially relative URL against a base URL */
function resolveRelativeUrl(url: string, base: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}
