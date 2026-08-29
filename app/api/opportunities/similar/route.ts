import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesCollection } from "@/lib/mongodb";

/**
 * GET /api/opportunities/similar?id=xxx
 * Returns similar opportunities based on category and tag overlap.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const limit = Math.min(6, parseInt(searchParams.get("limit") || "4", 10));

    if (!id) {
      return NextResponse.json({ items: [] });
    }

    const collection = await getOpportunitiesCollection();

    // Find the source opportunity
    const { ObjectId } = await import("mongodb");
    let source;
    try {
      source = await collection.findOne({ _id: new ObjectId(id) });
    } catch {
      return NextResponse.json({ items: [] });
    }

    if (!source) {
      return NextResponse.json({ items: [] });
    }

    // Build similarity query: same category + tag overlap
    const query: any = {
      _id: { $ne: source._id },
      lifecycleStatus: "active",
    };

    // Prefer same category
    if (source.category) {
      query.category = source.category;
    }

    // Find opportunities
    const candidates = await collection
      .find(query)
      .sort({ opportunityScore: -1 })
      .limit(limit + 5) // fetch extra to score
      .toArray();

    // Score by tag overlap
    const sourceTags = new Set((source.tags || []).map((t: string) => t.toLowerCase()));
    const scored = candidates.map((c) => {
      const cTags = new Set((c.tags || []).map((t: string) => t.toLowerCase()));
      let overlap = 0;
      for (const t of cTags) {
        if (sourceTags.has(t)) overlap++;
      }
      // Bonus for same organization
      if (c.organization === source.organization) overlap += 0.5;
      return { item: c, score: overlap };
    });

    // Sort by similarity score, then by opportunity score
    scored.sort((a, b) => b.score - a.score || (b.item.opportunityScore || 0) - (a.item.opportunityScore || 0));

    const items = scored.slice(0, limit).map((s) => ({
      ...s.item,
      _id: s.item._id.toString(),
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[Similar] Error:", err);
    return NextResponse.json({ items: [] });
  }
}
