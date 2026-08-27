import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { fetchOpenGraphImage } from "@/lib/images";

/**
 * POST /api/admin/backfill-images
 *
 * Batch-fetches OpenGraph images for all active opportunities
 * that are missing an imageUrl.
 *
 * Rate-limited: fetches 2 at a time with 500ms delay between batches.
 * Updates MongoDB directly.
 *
 * Returns: { backfilled: number, failed: number, skipped: number }
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const db = await getDb();
    const opps = await db
      .collection("opportunities")
      .find({
        lifecycleStatus: { $in: ["active", "closed"] },
        $or: [
          { imageUrl: { $exists: false } },
          { imageUrl: null },
          { imageUrl: "" },
        ],
      })
      .project({
        _id: 1,
        title: 1,
        sourceUrl: 1,
        applicationLink: 1,
        officialSourceUrl: 1,
        imageUrl: 1,
      })
      .toArray();

    let backfilled = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < opps.length; i += 2) {
      const batch = opps.slice(i, i + 2);

      const results = await Promise.allSettled(
        batch.map(async (opp: any) => {
          const url =
            opp.sourceUrl ||
            opp.applicationLink ||
            opp.officialSourceUrl;

          if (!url || !url.startsWith("http")) {
            skipped++;
            return null;
          }

          const imageUrl = await fetchOpenGraphImage(url, 15000);
          if (imageUrl) {
            await db
              .collection("opportunities")
              .updateOne(
                { _id: opp._id },
                { $set: { imageUrl, updatedAt: new Date() } }
              );
            backfilled++;
            return imageUrl;
          }
          failed++;
          return null;
        })
      );

      // Polite delay between batches
      if (i + 2 < opps.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return NextResponse.json({
      total: opps.length,
      backfilled,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("[Admin] Failed to backfill images:", error);
    return NextResponse.json(
      { error: "Failed to backfill images." },
      { status: 500 }
    );
  }
}
