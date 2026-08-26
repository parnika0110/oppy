import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSavedOpportunitiesCollection, getOpportunitiesCollection, ensureUserIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/userAuth";

/**
 * GET /api/saved
 * Returns the current user's saved opportunities (full documents, joined
 * against the opportunities collection — never stale/cached client copies).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const saved = await getSavedOpportunitiesCollection();
    const links = await saved.find({ userId: user.id }).sort({ savedAt: -1 }).toArray();
    if (links.length === 0) return NextResponse.json({ items: [] });

    const opportunities = await getOpportunitiesCollection();
    const ids = links
      .map((l) => {
        try {
          return new ObjectId(l.opportunityId);
        } catch {
          return null;
        }
      })
      .filter((x): x is ObjectId => x !== null);

    const docs = await opportunities.find({ _id: { $in: ids } }).toArray();
    const byId = new Map(docs.map((d) => [d._id.toString(), d]));

    // Preserve saved-order, skip any opportunity that's been removed/archived
    const items = links
      .map((l) => byId.get(l.opportunityId))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map((d) => ({ ...d, _id: d._id.toString() }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[Saved] Failed to load saved opportunities:", error);
    return NextResponse.json({ error: "Failed to load saved opportunities." }, { status: 500 });
  }
}

/**
 * POST /api/saved
 * Body: { opportunityId: string }
 * Toggles save state for the current user. Returns { saved: boolean }.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { opportunityId } = (await request.json()) || {};
    if (!opportunityId || !ObjectId.isValid(opportunityId)) {
      return NextResponse.json({ error: "Invalid opportunity id." }, { status: 400 });
    }

    await ensureUserIndexes();
    const saved = await getSavedOpportunitiesCollection();

    const existing = await saved.findOne({ userId: user.id, opportunityId });
    if (existing) {
      // Ownership is implicit here — the query is scoped to user.id from the
      // session, so a user can never unsave another user's saved record.
      await saved.deleteOne({ _id: existing._id });
      return NextResponse.json({ saved: false });
    }

    await saved.insertOne({ userId: user.id, opportunityId, savedAt: new Date() });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("[Saved] Toggle failed:", error);
    return NextResponse.json({ error: "Failed to update saved state." }, { status: 500 });
  }
}
