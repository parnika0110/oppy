/**
 * Image Backfill Script
 *
 * Fetches OG images for opportunities missing imageUrl.
 * Processes in batches to avoid rate limiting.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/image-backfill.ts
 *   npm run images:backfill
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || "oppy";
const BATCH_SIZE = 10;
const DELAY_MS = 1500; // polite delay between requests

// Generic platform images to reject
const GENERIC_PLATFORM_PATTERNS = [
  "eventbrite.com/static/images/",
  "lu.ma/static/",
  "linkedin.com/mpr/",
  "internshala.com/images/",
  "github.com/identicons/",
  "github.com/favicon",
  "devpost.com/screenshot/",
  "devfolio.co/images/",
  "unstop.com/public/images/",
];

function isImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path.endsWith(".html") || path.endsWith(".htm")) return false;
    if (path.includes("favicon")) return false;
    if (GENERIC_PLATFORM_PATTERNS.some(p => url.includes(p))) return false;
    if (path.includes("/login") || path.includes("/signup")) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OPPYBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Try og:image
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch?.[1] && isImageUrl(ogMatch[1])) return ogMatch[1];

    // Try twitter:image
    const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twMatch?.[1] && isImageUrl(twMatch[1])) return twMatch[1];

    // Try JSON-LD
    const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (ldBlocks) {
      for (const block of ldBlocks) {
        try {
          const jsonStr = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
          const data = JSON.parse(jsonStr);
          if (data.image) {
            const imgUrl = typeof data.image === "string" ? data.image : data.image?.url;
            if (imgUrl && isImageUrl(imgUrl)) return imgUrl;
          }
        } catch { /* skip */ }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection("opportunities");

  // Find active opportunities without imageUrl that have a URL to fetch
  const filter: any = {
    lifecycleStatus: "active",
    $or: [
      { imageUrl: { $exists: false } },
      { imageUrl: null },
      { imageUrl: "" },
    ],
  };
  const missing = await col
    .find(filter)
    .sort({ opportunityScore: -1, createdAt: -1 })
    .limit(100)
    .toArray();

  console.log(`Found ${missing.length} active opportunities without imageUrl`);
  console.log(`Processing in batches of ${BATCH_SIZE} with ${DELAY_MS}ms delay\n`);

  let fetched = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(missing.length / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches}...`);

    for (const opp of batch) {
      const pageUrl = opp.applicationLink || opp.sourceUrl;
      if (!pageUrl || !pageUrl.startsWith("http")) {
        skipped++;
        continue;
      }

      const ogImage = await fetchOgImage(pageUrl);
      if (ogImage) {
        await col.updateOne(
          { _id: opp._id },
          { $set: { imageUrl: ogImage, updatedAt: new Date() } }
        );
        fetched++;
        console.log(`  ✓ ${opp.title?.substring(0, 50)} → ${ogImage.substring(0, 60)}`);
      } else {
        skipped++;
      }
    }

    // Polite delay between batches
    if (i + BATCH_SIZE < missing.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Fetched: ${fetched}`);
  console.log(`Skipped (no image found): ${skipped}`);
  console.log(`Total processed: ${missing.length}`);

  await client.close();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
