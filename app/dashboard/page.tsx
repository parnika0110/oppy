import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/userAuth";
import { getOpportunitiesCollection, getSavedOpportunitiesCollection, getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import OpportunityCard from "@/components/OpportunityCard";
import ExplanationBadge from "@/components/ExplanationBadge";
import OppyEmptyState from "@/components/OppyEmptyState";
import { OpportunityDocument } from "@/types/opportunity";
import { rankForUser } from "@/lib/recommendations";

function serialize(doc: any): OpportunityDocument {
  return { ...doc, _id: doc._id.toString() };
}

async function getDashboardData(userId: string) {
  const opportunities = await getOpportunitiesCollection();
  const saved = await getSavedOpportunitiesCollection();

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const activeFilter = {
    $or: [{ lifecycleStatus: "active" }, { lifecycleStatus: { $exists: false }, isActive: true }],
  };

  const [
    allActive,
    closingSoon,
    upcomingEvents,
    savedLinks,
    activeCount,
    recentlyViewedLinks,
  ] = await Promise.all([
    // Get all active opportunities for recommendation scoring
    opportunities.find(activeFilter).sort({ opportunityScore: -1, createdAt: -1 }).limit(100).toArray(),
    // Closing soon: active opportunities with deadline in next 14 days
    opportunities
      .find({
        ...activeFilter,
        $or: [
          { applicationDeadline: { $gte: now, $lte: in14Days } },
          { registrationDeadline: { $gte: now, $lte: in14Days } },
          { deadline: { $gte: now, $lte: in14Days }, deadlineKind: { $in: ["verified", "source_provided"] } },
        ],
      })
      .limit(6)
      .toArray(),
    // Upcoming events: use eventDate (NOT just category === "Event")
    // Any opportunity with a future eventDate qualifies
    opportunities
      .find({
        ...activeFilter,
        eventDate: { $gte: now },
      })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray(),
    // Saved
    saved.find({ userId }).sort({ createdAt: -1 }).limit(6).toArray(),
    // Active count
    opportunities.countDocuments(activeFilter),
    // Recently viewed
    getRecentlyViewed(userId),
  ]);

  let savedItems: OpportunityDocument[] = [];
  if (savedLinks.length > 0) {
    const ids = savedLinks
      .map((l) => {
        try { return new ObjectId(l.opportunityId); } catch { return null; }
      })
      .filter((x): x is ObjectId => x !== null);
    const docs = await opportunities.find({ _id: { $in: ids } }).toArray();
    const byId = new Map(docs.map((d) => [d._id.toString(), d]));
    savedItems = savedLinks
      .map((l) => byId.get(l.opportunityId))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map(serialize);
  }

  return {
    allActive: allActive.map(serialize),
    closingSoon: closingSoon.map(serialize),
    upcomingEvents: upcomingEvents.map(serialize),
    savedItems,
    activeCount,
    recentlyViewedItems: recentlyViewedLinks,
  };
}

async function getRecentlyViewed(userId: string): Promise<OpportunityDocument[]> {
  try {
    const db = await getDb();
    const views = await db
      .collection("recentlyViewed")
      .find({ userId })
      .sort({ viewedAt: -1 })
      .limit(6)
      .toArray();

    if (views.length === 0) return [];

    const oppIds = views
      .map((v) => {
        try { return new ObjectId(v.opportunityId); } catch { return null; }
      })
      .filter((x): x is ObjectId => x !== null);

    if (oppIds.length === 0) return [];

    const opportunities = await getOpportunitiesCollection();
    const docs = await opportunities.find({ _id: { $in: oppIds } }).toArray();
    const byId = new Map(docs.map((d) => [d._id.toString(), d]));

    return views
      .map((v) => byId.get(v.opportunityId))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map(serialize);
  } catch {
    return [];
  }
}

function Section({
  title,
  emptyMessage,
  emptyMood,
  items,
  explanations,
}: {
  title: string;
  emptyMessage: string;
  emptyMood?: "curious" | "thinking" | "no-results" | "welcoming";
  items: OpportunityDocument[];
  explanations?: Map<string, string[]>;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-display font-semibold mb-4" style={{ fontSize: "1.15rem", color: "var(--ink)" }}>
        {title}
      </h2>
      {items.length === 0 ? (
        <OppyEmptyState
          mood={emptyMood || "curious"}
          title={emptyMessage}
          size={40}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((opp) => (
            <div key={opp._id} className="relative">
              <OpportunityCard opportunity={opp} />
              {explanations && explanations.has(opp._id) && (
                <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                  {explanations.get(opp._id)!.map((exp, i) => (
                    <ExplanationBadge key={i} text={exp} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const { allActive, closingSoon, upcomingEvents, savedItems, activeCount, recentlyViewedItems } = await getDashboardData(user.id);

  const firstName = user.name.split(" ")[0];

  // Personalized recommendations
  const recommended = rankForUser(user, allActive, 6);
  const recommendedIds = new Set(recommended.map((r) => r.opportunity._id));
  const explanations = new Map<string, string[]>();
  for (const r of recommended) {
    explanations.set(r.opportunity._id, r.explanation);
  }

  // For "New opportunities", exclude already-recommended ones to avoid duplication
  const newOpportunities = allActive
    .filter((opp) => !recommendedIds.has(opp._id))
    .slice(0, 6);

  return (
    <div>
      <div className="mb-10">
        <p className="eyebrow mb-2">Dashboard</p>
        <h1 className="font-display font-semibold tracking-tight" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)" }}>
          Good to see you, {firstName}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          {activeCount} active {activeCount === 1 ? "opportunity" : "opportunities"} in OPPY right now.
        </p>
        {!user.onboardingComplete && (
          <div
            className="mt-5 p-4 rounded-2xl flex items-center gap-4"
            style={{ background: "var(--lavender)", border: "1px solid var(--lavender-deep)" }}
          >
            <div className="flex-1">
              <p className="font-medium text-sm" style={{ color: "#4A3F8A" }}>
                Get better recommendations
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "#5A4F9A" }}>
                Tell OPPY about your skills, interests, and preferences to unlock personalized results.
              </p>
            </div>
            <a
              href="/onboarding"
              className="shrink-0 text-xs font-medium px-4 py-2 rounded-full"
              style={{ background: "#4A3F8A", color: "white", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Finish setup →
            </a>
          </div>
        )}
      </div>

      <Section
        title="Recommended for you"
        items={recommended.map((r) => r.opportunity)}
        explanations={explanations}
        emptyMood={user.onboardingComplete ? "thinking" : "welcoming"}
        emptyMessage={
          user.onboardingComplete
            ? "We're learning your preferences. Browse more to improve recommendations."
            : "Set your skills and interests to get personalized recommendations."
        }
      />

      <Section
        title="New opportunities"
        items={newOpportunities}
        emptyMood="curious"
        emptyMessage="No new opportunities yet. We'll surface them here as they're discovered."
      />

      <Section
        title="Closing soon"
        items={closingSoon}
        emptyMood="welcoming"
        emptyMessage="Nothing closing in the next two weeks right now."
      />

      <Section
        title="Upcoming events"
        items={upcomingEvents}
        emptyMood="curious"
        emptyMessage="No upcoming events discovered yet."
      />

      <Section
        title="Saved opportunities"
        items={savedItems}
        emptyMood="no-results"
        emptyMessage="You haven't saved anything yet. Browse opportunities and tap the bookmark icon."
      />

      {recentlyViewedItems.length > 0 && (
        <Section
          title="Recently viewed"
          items={recentlyViewedItems}
          emptyMessage=""
        />
      )}
    </div>
  );
}
