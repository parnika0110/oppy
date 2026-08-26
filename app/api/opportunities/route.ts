import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesCollection } from "@/lib/mongodb";
import { publicOpportunityFilter, opportunitySort } from "@/lib/opportunities";

export const revalidate = 60; // ISR-friendly caching hint for GET
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    console.log(`[API] GET /api/opportunities hit. Params: ${searchParams.toString()}`);

    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category");
    const location = searchParams.get("location")?.trim();
    const tag = searchParams.get("tag")?.trim();
    const sort = searchParams.get("sort") || "newest";
    const showClosed = searchParams.get("showClosed") === "true" || searchParams.get("showExpired") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const filter = publicOpportunityFilter({ q, category, location, tag, showClosed });
    const sortSpec = opportunitySort(sort);

    console.log("[API] Executing MongoDB query with filter:", JSON.stringify(filter));
    const collection = await getOpportunitiesCollection();

    const [items, total] = await Promise.all([
      collection
        .find(filter)
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    
    console.log(`[API] Query successful. Returning ${items.length} items (Total: ${total}).`);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[API] GET /api/opportunities failed:", error);
    return NextResponse.json(
      { error: "Unable to load opportunities right now. Please try again." },
      { status: 500 }
    );
  }
}
