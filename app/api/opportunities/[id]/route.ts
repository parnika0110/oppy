import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/opportunities/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID." }, { status: 400 });
    }

    const collection = await getOpportunitiesCollection();
    const item = await collection.findOne({ _id: new ObjectId(id) });

    if (!item) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ item: { ...item, _id: item._id.toString() } });
  } catch (err) {
    console.error("[Opportunity] Error:", err);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
