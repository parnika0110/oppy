import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { resolveImageUrl } from "@/lib/images";

/**
 * GET /api/og-image?url=<pageUrl>&persist=<opportunityId>
 *
 * Fetches a page and extracts the best available image using multiple strategies:
 * 1. og:image meta tag
 * 2. twitter:image meta tag
 * 3. apple-touch-icon
 * 4. Large icon with sizes attribute
 * 5. JSON-LD image field
 * 6. First meaningful <img> tag
 *
 * If `persist` is provided, also updates the opportunity's imageUrl in MongoDB.
 *
 * Returns: { imageUrl: string | null }
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const persistId = request.nextUrl.searchParams.get("persist");

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ imageUrl: null });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json({ imageUrl: null });
    }

    const html = await res.text();
    const resolvedUrl = res.url || url;

    let imageUrl: string | null = null;

    // 1. og:image (property before content)
    const ogMatch = html.match(
      /<meta\s+(?:[^>]*?)property=["']og:image["'][^>]*?content=["']([^"']+)["']/i
    );
    if (ogMatch?.[1]) {
      imageUrl = resolveImageUrl(ogMatch[1], resolvedUrl);
    }

    // 2. og:image reversed (content before property)
    if (!imageUrl) {
      const ogMatch2 = html.match(
        /<meta\s+(?:[^>]*?)content=["']([^"']+)["'][^>]*?property=["']og:image["']/i
      );
      if (ogMatch2?.[1]) {
        imageUrl = resolveImageUrl(ogMatch2[1], resolvedUrl);
      }
    }

    // 3. twitter:image
    if (!imageUrl) {
      const twMatch = html.match(
        /<meta\s+(?:[^>]*?)(?:name|property)=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i
      );
      if (twMatch?.[1]) {
        imageUrl = resolveImageUrl(twMatch[1], resolvedUrl);
      }
    }

    // 4. twitter:image:src
    if (!imageUrl) {
      const twMatch2 = html.match(
        /<meta\s+(?:[^>]*?)content=["']([^"']+)["'][^>]*?(?:name|property)=["']twitter:image["']/i
      );
      if (twMatch2?.[1]) {
        imageUrl = resolveImageUrl(twMatch2[1], resolvedUrl);
      }
    }

    // 5. apple-touch-icon
    if (!imageUrl) {
      const iconMatch = html.match(
        /<link\s+(?:[^>]*?)rel=["']apple-touch-icon["'][^>]*?href=["']([^"']+)["']/i
      );
      if (iconMatch?.[1]) {
        imageUrl = resolveImageUrl(iconMatch[1], resolvedUrl);
      }
    }

    // 6. Large icon with sizes attribute
    if (!imageUrl) {
      const sizedIcon = html.match(
        /<link\s+(?:[^>]*?)rel=["']icon["'][^>]*?sizes=["'](\d+)x\d+["'][^>]*?href=["']([^"']+)["']/i
      );
      if (sizedIcon?.[2] && parseInt(sizedIcon[1]) >= 192) {
        imageUrl = resolveImageUrl(sizedIcon[2], resolvedUrl);
      }
    }

    // 7. JSON-LD image field
    if (!imageUrl) {
      const ldMatch = html.match(
        /["']image["']\s*:\s*["']([^"']+\.(?:png|jpg|jpeg|webp))["']/i
      );
      if (ldMatch?.[1]) {
        imageUrl = resolveImageUrl(ldMatch[1], resolvedUrl);
      }
    }

    // 8. First meaningful <img> with size attributes
    if (!imageUrl) {
      const imgMatch = html.match(
        /<img\s+(?:[^>]*?)src=["']([^"']+.(?:png|jpg|jpeg|webp))["'][^>]*(?:width|height)=["'](\d+)/i
      );
      if (imgMatch?.[1] && parseInt(imgMatch[2] || "0") >= 200) {
        imageUrl = resolveImageUrl(imgMatch[1], resolvedUrl);
      }
    }

    // 9. Any <img> with image extension (skip favicons/icons)
    if (!imageUrl) {
      const anyImg = html.match(
        /<img\s+(?:[^>]*?)src=["']([^"']+.(?:png|jpg|jpeg|webp))["']/i
      );
      if (anyImg?.[1] && !anyImg[1].match(/favicon|icon\.|logo\.(?:ico|svg)/i)) {
        imageUrl = resolveImageUrl(anyImg[1], resolvedUrl);
      }
    }

    // Persist to MongoDB if requested
    if (imageUrl && persistId) {
      try {
        const db = await getDb();
        await db
          .collection("opportunities")
          .updateOne(
            { _id: new ObjectId(persistId) },
            { $set: { imageUrl, updatedAt: new Date() } }
          );
      } catch {
        // Don't fail the request if persistence fails
      }
    }

    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
