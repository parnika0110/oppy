import { NextRequest, NextResponse } from "next/server";
import { publicOpportunityFilter, opportunitySort } from "@/lib/opportunities";
import { getOpportunitiesCollection } from "@/lib/mongodb";

/**
 * GET /api/opportunities
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim() || undefined;
    const category = searchParams.get("category") || undefined;
    const categories = searchParams.get("categories") || undefined;
    const interests = searchParams.get("interests") || undefined;
    const location = searchParams.get("location")?.trim() || undefined;
    const tag = searchParams.get("tag")?.trim() || undefined;
    const remote = searchParams.get("remote") || undefined;
    const experience = searchParams.get("experience") || undefined;
    const sort = searchParams.get("sort") || "recommended";
    const showClosed = searchParams.get("showClosed") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));

    const filter = publicOpportunityFilter({ q, category, categories, interests, location, tag, remote, experience, showClosed });
    const sortSpec = opportunitySort(sort);

    const collection = await getOpportunitiesCollection();
    const [items, total] = await Promise.all([
      collection.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(filter),
    ]);

    const serializedItems = items.map((item) => ({ ...item, _id: item._id.toString() }));

    return NextResponse.json({
      items: serializedItems,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[Opportunities] Error:", err);
    return NextResponse.json(
      { items: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } },
      { status: 500 }
    );
  }
}
