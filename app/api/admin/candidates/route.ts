import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, getOpportunitiesCollection } from "@/lib/mongodb";
import { isAdminRequest } from "@/lib/auth";
import { assessCandidate } from "@/lib/discovery/quality";
import { scoreOpportunity } from "@/lib/discovery/rank";
import type { DiscoveryCandidate } from "@/lib/discovery/contracts";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const state = request.nextUrl.searchParams.get("state") || "pending";
  try {
    const db = await getDb();
    const items = await db.collection("discoveryCandidates").find({ validationState: state }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ items: items.map((item) => ({ ...item, _id: item._id.toString() })) });
  } catch { return NextResponse.json({ error: "Unable to load candidates." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { id, action } = await request.json();
    if (!ObjectId.isValid(id) || !["approve", "reject", "archive"].includes(action)) return NextResponse.json({ error: "Invalid candidate action." }, { status: 400 });
    const db = await getDb(); const candidates = db.collection("discoveryCandidates");
    const candidate = await candidates.findOne({ _id: new ObjectId(id) });
    if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    if (action !== "approve") {
      await candidates.updateOne({ _id: candidate._id }, { $set: { validationState: action === "archive" ? "rejected" : "rejected", reviewAction: action, reviewedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    const discoveryCandidate = candidate as unknown as DiscoveryCandidate & { canonicalUrl?: string; contentHash?: string; firstSeenAt?: Date };
    const quality = assessCandidate(discoveryCandidate);
    if (!quality.publishable && candidate.candidateType !== "opportunity") return NextResponse.json({ error: "This discovery needs authoritative opportunity evidence before publication." }, { status: 409 });
    const opportunities = await getOpportunitiesCollection();
    const duplicate = await opportunities.findOne({ $or: [{ officialSourceUrl: candidate.canonicalUrl }, { sourceId: candidate.sourceId }, { contentHash: candidate.contentHash }] });
    if (duplicate) return NextResponse.json({ error: "A matching opportunity already exists." }, { status: 409 });
    const now = new Date();
    const score = scoreOpportunity({ trustTier: candidate.trustTier, completeness: [candidate.title, candidate.organization, candidate.description, candidate.url].filter(Boolean).length * 25, deadlineKind: candidate.deadlineKind });
    await opportunities.insertOne({ title: candidate.title, organization: candidate.organization, category: candidate.category || "Event", location: candidate.location || "Remote", tags: candidate.tags || [], description: candidate.description || "", applicationLink: candidate.url, officialSourceUrl: candidate.url, sourceUrl: candidate.url, sourcePlatform: candidate.sourcePlatform, sourceId: candidate.sourceId, discoveredFrom: candidate.discoveredFrom, contentHash: candidate.contentHash, deadline: candidate.deadline || null, deadlineKind: candidate.deadlineKind || "unavailable", deadlineLastVerifiedAt: candidate.deadline ? now : null, lastVerifiedAt: now, qualityScore: score.qualityScore, opportunityScore: score.opportunityScore, scoreVersion: score.scoreVersion, enrichmentVersion: null, aiSummary: null, categoryValidation: null, lifecycleStatus: "active", isActive: true, firstSeenAt: candidate.firstSeenAt || now, lastSeenAt: now, createdAt: now, updatedAt: now });
    await candidates.updateOne({ _id: candidate._id }, { $set: { validationState: "approved", reviewedAt: now, publishedAt: now } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to update candidate." }, { status: 500 }); }
}
