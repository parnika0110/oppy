import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesCollection } from "@/lib/mongodb";
import { Category, CATEGORIES } from "@/types/opportunity";
import type { Filter, Document, Sort } from "mongodb";

export const revalidate = 60; // ISR-friendly caching hint for GET
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    console.log(`[API] GET /api/opportunities hit. Params: ${searchParams.toString()}`);

    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category") as Category | null;
    const location = searchParams.get("location")?.trim();
    const tag = searchParams.get("tag")?.trim();
    const sort = searchParams.get("sort") || "newest";
    const showExpired = searchParams.get("showExpired") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const filter: Filter<Document> = { isActive: true };

    if (!showExpired) {
      filter.$or = [
        { deadlineKind: { $in: ["verified", "source_provided"] }, deadline: { $gte: new Date() } },
        { deadlineKind: { $in: ["rolling", "unavailable"] } },
        { deadlineKind: { $exists: false } },
        { deadline: null },
        { deadline: { $exists: false } },
      ];
    }

    if (category && CATEGORIES.includes(category)) {
      filter.category = category;
    }

    if (location) {
      filter.location = location;
    }

    if (tag) {
      filter.tags = tag;
    }

    if (q) {
      // Requires the text index created on {title, description, organization}
      filter.$text = { $search: q };
    }

    const sortMap: Record<string, Sort> = {
      deadline_asc: { deadline: 1 },
      deadline_desc: { deadline: -1 },
      newest: { createdAt: -1 },
    };
    const sortSpec = sortMap[sort] || sortMap.deadline_asc;

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
      { error: "Failed to fetch opportunities.", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
