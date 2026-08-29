import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesCollection } from "@/lib/mongodb";

/**
 * GET /api/organizations
 * GET /api/organizations?name=Google
 * Returns organization listing or details.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();
    const collection = await getOpportunitiesCollection();

    if (name) {
      // Get details for a specific organization
      const items = await collection
        .find({
          organization: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
          lifecycleStatus: "active",
        })
        .sort({ opportunityScore: -1 })
        .limit(50)
        .toArray();

      const serialized = items.map((item) => ({ ...item, _id: item._id.toString() }));

      // Compute org stats
      const categories = [...new Set(serialized.map((i: any) => i.category))].filter(Boolean);
      const locations = [...new Set(serialized.map((i: any) => i.location).filter(Boolean))];

      return NextResponse.json({
        name,
        total: serialized.length,
        categories,
        locations,
        items: serialized,
      });
    }

    // List all organizations with counts
    const pipeline = [
      { $match: { lifecycleStatus: "active", organization: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$organization",
          count: { $sum: 1 },
          categories: { $addToSet: "$category" },
          latestScore: { $max: "$opportunityScore" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const orgs = results.map((r: any) => ({
      name: r._id,
      count: r.count,
      categories: r.categories.filter(Boolean),
      score: r.latestScore,
    }));

    return NextResponse.json({ organizations: orgs });
  } catch (err) {
    console.error("[Organizations] Error:", err);
    return NextResponse.json({ organizations: [] });
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
