import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userAuth";
import {
  getApplicationTrackingCollection,
  getOpportunitiesCollection,
  ensureUserIndexes,
} from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const VALID_STATUSES = [
  "interested",
  "saved",
  "applied",
  "interview",
  "rejected",
  "accepted",
  "archived",
] as const;

/**
 * GET /api/tracking
 * Returns the current user's application tracking entries joined with opportunity data.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ items: [] }, { status: 401 });
    }

    await ensureUserIndexes();
    const tracking = await getApplicationTrackingCollection();

    // Support optional filtering by opportunityId (used by DetailTracker)
    const url = new URL(request.url);
    const filterOpportunityId = url.searchParams.get("opportunityId");
    const query: Record<string, any> = { userId: user.id };
    if (filterOpportunityId && ObjectId.isValid(filterOpportunityId)) {
      query.opportunityId = filterOpportunityId;
    }

    const entries = await tracking
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();

    if (entries.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Join with opportunity data
    const opps = await getOpportunitiesCollection();
    const oppIds = entries
      .map((e: any) => {
        try { return new ObjectId(e.opportunityId); } catch { return null; }
      })
      .filter((x): x is ObjectId => x !== null);

    const oppDocs = oppIds.length > 0
      ? await opps.find({ _id: { $in: oppIds } }).toArray()
      : [];

    const oppMap = new Map(oppDocs.map((d: any) => [d._id.toString(), d]));

    const items = entries.map((entry: any) => ({
      ...entry,
      _id: entry._id.toString(),
      opportunity: oppMap.get(entry.opportunityId) || null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[Tracking] GET error:", err);
    return NextResponse.json({ error: "Failed to load tracking data." }, { status: 500 });
  }
}

/**
 * POST /api/tracking
 * Create or update a tracking entry.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { opportunityId, status, notes } = body;

    if (!opportunityId || !status) {
      return NextResponse.json(
        { error: "opportunityId and status required." },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    // Validate opportunityId is a valid ObjectId
    if (!ObjectId.isValid(opportunityId)) {
      return NextResponse.json(
        { error: "Invalid opportunity ID." },
        { status: 400 }
      );
    }

    await ensureUserIndexes();
    const tracking = await getApplicationTrackingCollection();
    const now = new Date();

    const update: Record<string, any> = {
      status,
      notes: notes || null,
      updatedAt: now,
    };

    if (status === "applied") {
      update.appliedAt = now;
    }

    const result = await tracking.findOneAndUpdate(
      { userId: user.id, opportunityId },
      {
        $set: update,
        $setOnInsert: {
          userId: user.id,
          opportunityId,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    return NextResponse.json({ success: true, id: result?._id?.toString() });
  } catch (err) {
    console.error("[Tracking] POST error:", err);
    return NextResponse.json(
      { error: "Failed to update tracking." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tracking?opportunityId=...
 * Remove a tracking entry.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunityId");

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId required." },
        { status: 400 }
      );
    }

    await ensureUserIndexes();
    const tracking = await getApplicationTrackingCollection();
    const result = await tracking.deleteOne({ userId: user.id, opportunityId });

    return NextResponse.json({ success: true, deleted: result.deletedCount > 0 });
  } catch (err) {
    console.error("[Tracking] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete tracking entry." }, { status: 500 });
  }
}
