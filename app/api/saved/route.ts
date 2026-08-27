import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userAuth";
import { getSavedOpportunitiesCollection, getOpportunitiesCollection, ensureUserIndexes } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/saved
 * POST /api/saved
 * DELETE /api/saved
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureUserIndexes();
    const saved = await getSavedOpportunitiesCollection();
    const opps = await getOpportunitiesCollection();

    const saves = await saved.find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
    const oppIds = saves.map((s: any) => new ObjectId(s.opportunityId));

    const items = await opps.find({ _id: { $in: oppIds } }).toArray();

    return NextResponse.json({
      items: items.map((item: any) => ({ ...item, _id: item._id.toString() })),
    });
  } catch (err) {
    console.error("[Saved] Error:", err);
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { opportunityId } = body;

    if (!opportunityId) {
      return NextResponse.json({ error: "opportunityId required." }, { status: 400 });
    }

    // Validate ObjectId
    if (!ObjectId.isValid(opportunityId)) {
      return NextResponse.json({ error: "Invalid opportunity ID." }, { status: 400 });
    }

    await ensureUserIndexes();
    const saved = await getSavedOpportunitiesCollection();

    // Check if already saved
    const existing = await saved.findOne({ userId: user.id, opportunityId });
    if (existing) {
      return NextResponse.json({ saved: true });
    }

    await saved.insertOne({
      userId: user.id,
      opportunityId,
      createdAt: new Date(),
    });

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error("[Saved] Error:", err);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunityId");

    if (!opportunityId) {
      return NextResponse.json({ error: "opportunityId required." }, { status: 400 });
    }

    await ensureUserIndexes();
    const saved = await getSavedOpportunitiesCollection();
    await saved.deleteOne({ userId: user.id, opportunityId });

    return NextResponse.json({ saved: false });
  } catch (err) {
    console.error("[Saved] Error:", err);
    return NextResponse.json({ saved: false });
  }
}
