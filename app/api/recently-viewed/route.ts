import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userAuth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/recently-viewed
 * POST /api/recently-viewed
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ items: [] });
    }

    const db = await getDb();
    const views = db.collection("recentlyViewed");
    const opps = db.collection("opportunities");

    const recent = await views
      .find({ userId: user.id })
      .sort({ viewedAt: -1 })
      .limit(6)
      .toArray();

    const oppIds = recent.map((r: any) => r.opportunityId).filter(Boolean);
    const items = await opps.find({ _id: { $in: oppIds.map((id: string) => new ObjectId(id)) } }).toArray();

    return NextResponse.json({
      items: items.map((item: any) => ({ ...item, _id: item._id.toString() })),
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: true });

    const body = await request.json();
    const { opportunityId } = body;

    if (!opportunityId) return NextResponse.json({ error: "opportunityId required" }, { status: 400 });

    const db = await getDb();
    const views = db.collection("recentlyViewed");

    await views.insertOne({
      userId: user.id,
      opportunityId,
      viewedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
