import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getOpportunitiesCollection } from "@/lib/mongodb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid opportunity id." }, { status: 400 });
    }

    const collection = await getOpportunitiesCollection();
    const opportunity = await collection.findOne({ _id: new ObjectId(id), lifecycleStatus: { $ne: "archived" } });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }

    return NextResponse.json({ item: opportunity });
  } catch (error) {
    console.error("GET /api/opportunities/[id] failed:", error);
    return NextResponse.json(
      { error: "Unable to load this opportunity right now." },
      { status: 500 }
    );
  }
}
