import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/userAuth";
import { getOpportunitiesCollection, getSavedOpportunitiesCollection, getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import OpportunityCard from "@/components/OpportunityCard";
import ExplanationBadge from "@/components/ExplanationBadge";
import OppyEmptyState from "@/components/OppyEmptyState";
import ThemedOppyOrb from "@/components/ThemedOppyOrb";
import TrackingDashboard from "@/components/TrackingDashboard";
import { OpportunityDocument } from "@/types/opportunity";
import { rankOpportunities, getMatchLabels, type DiscoveryPreferences } from "@/lib/relevance";

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
    // Rank the complete active pool for personalization (no arbitrary limit)
    opportunities.find(activeFilter).sort({ opportunityScore: -1, createdAt: -1 }).toArray(),
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

    // Deduplicate by opportunityId — a user may view the same opportunity multiple times
    const seen = new Set<string>();
    const uniqueViews = views.filter((v: any) => {
      if (seen.has(v.opportunityId)) return false;
      seen.add(v.opportunityId);
      return true;
    });

    const oppIds = uniqueViews
      .map((v) => {
        try { return new ObjectId(v.opportunityId); } catch { return null; }
      })
      .filter((x): x is ObjectId => x !== null);

    if (oppIds.length === 0) return [];

    const opportunities = await getOpportunitiesCollection();
    const docs = await opportunities.find({ _id: { $in: oppIds } }).toArray();
    const byId = new Map(docs.map((d) => [d._id.toString(), d]));

    return uniqueViews
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
  emptyAction,
  items,
  explanations,
}: {
  title: string;
  emptyMessage: string;
  emptyMood?: "curious" | "thinking" | "no-results" | "welcoming";
  emptyAction?: { label: string; href: string };
  items: OpportunityDocument[];
  explanations?: Map<string, string[]>;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-display font-semibold mb-4" style={{ fontSize: "1.15rem", color: "var(--ink)" }}>
        {title}
      </h2>
      {items.length === 0 ? (
        <div className="flex items-center justify-between py-4 px-5 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3">
            <ThemedOppyOrb mood={emptyMood || "curious"} size={28} />
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{emptyMessage}</p>
          </div>
          {emptyAction && (
            <a href={emptyAction.href} className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--accent-deep)", fontFamily: "'Space Grotesk', sans-serif" }}>
              {emptyAction.label}
            </a>
          )}
        </div>
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

  // Personalized recommendations using the stronger relevance scoring system
  // Resolve taxonomy entries for canonical matching (handles legacy free-text values)
  const { resolveInterests, resolveSkills, resolveLocations } = await import("@/lib/taxonomies");
  const rawInterests = user.preferences?.interests || [];
  const normalizedInterests = resolveInterests(rawInterests);
  const rawSkills = user.preferences?.skills || [];
  const normalizedSkills = resolveSkills(rawSkills);
  const rawLocations = user.preferences?.locations || [];
  const normalizedLocations = resolveLocations(rawLocations);

  const prefs: DiscoveryPreferences = {
    categories: user.preferences?.categories?.length ? user.preferences.categories : undefined,
    interests: normalizedInterests.length > 0 ? normalizedInterests : undefined,
    skills: normalizedSkills.length > 0 ? normalizedSkills : undefined,
    location: normalizedLocations.length > 0 ? normalizedLocations[0] : undefined,
    remote: user.preferences?.remote === true,
    experience: user.preferences?.experience || undefined,
    // Resume-derived signals (lower weight than explicit preferences)
    resumeSkills: user.resumeProfile?.extractedSkills,
    resumeInterests: user.resumeProfile?.extractedInterests,
    resumeDomains: user.resumeProfile?.domains,
  };

  const hasPrefs = Boolean(prefs.categories?.length || prefs.interests?.length || prefs.skills?.length || prefs.location || prefs.remote || prefs.experience);

  let recommendedItems: OpportunityDocument[];
  const explanations = new Map<string, string[]>();

  if (hasPrefs) {
    // For multi-location users, score against each location and take the best ranking
    const locations = normalizedLocations;
    let ranked;
    if (locations.length > 1) {
      // Score with each location, merge and deduplicate by taking the best score per opportunity
      const byId = new Map<string, { opp: typeof allActive[0]; bestTotal: number; bestRanked: ReturnType<typeof rankOpportunities>[0] }>();
      for (const loc of locations) {
        const locPrefs = { ...prefs, location: loc };
        const locRanked = rankOpportunities(allActive, locPrefs);
        for (const r of locRanked) {
          const id = r.opportunity._id;
          const existing = byId.get(id);
          if (!existing || r.score.total > existing.bestTotal) {
            byId.set(id, { opp: r.opportunity, bestTotal: r.score.total, bestRanked: r });
          }
        }
      }
      ranked = Array.from(byId.values()).map((v) => v.bestRanked).sort((a, b) => b.score.total - a.score.total);
    } else {
      ranked = rankOpportunities(allActive, prefs);
    }
    recommendedItems = ranked.slice(0, 6).map((r) => r.opportunity);
    // Build explanations from the same scoring system used for ranking
    for (const r of ranked.slice(0, 6)) {
      const labels = getMatchLabels(r.score, prefs);
      if (labels.length > 0) {
        explanations.set(r.opportunity._id, labels);
      }
    }
  } else {
    // No preferences set — show top-quality opportunities without false personalization badges
    recommendedItems = allActive.slice(0, 6);
  }

  const recommendedIds = new Set(recommendedItems.map((r) => r._id));

  // For "New opportunities", exclude already-recommended ones to avoid duplication
  const newOpportunities = allActive
    .filter((opp) => !recommendedIds.has(opp._id))
    .slice(0, 6);

  return (
    <div>
      <div className="mb-10 flex items-start gap-4">
        <div className="flex-1">
          <p className="eyebrow mb-2">Dashboard</p>
          <h1 className="font-display font-semibold tracking-tight" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)" }}>
            Good to see you, {firstName}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            {activeCount} active {activeCount === 1 ? "opportunity" : "opportunities"} in OPPY right now.
          </p>
        </div>
        {user.onboardingComplete && (
          <div className="hidden sm:block mt-1">
            <ThemedOppyOrb mood="welcoming" size={48} />
          </div>
        )}
        {!user.onboardingComplete && (
          <div
            className="mt-5 p-4 rounded-2xl flex items-center gap-4"
            style={{ background: "var(--accent)", border: "1px solid var(--accent-deep)" }}
          >
            <div className="flex-1">
              <p className="font-medium text-sm" style={{ color: "var(--accent-deep)" }}>
                Get better recommendations
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--ink-soft)" }}>
                Tell OPPY about your skills, interests, and preferences to unlock personalized results.
              </p>
            </div>
            <a
              href="/onboarding"
              className="shrink-0 text-xs font-medium px-4 py-2 rounded-full"
              style={{ background: "var(--accent-deep)", color: "white", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Finish setup →
            </a>
          </div>
        )}
      </div>        <Section
        title="Recommended for you"
        items={recommendedItems}
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
        emptyMessage="No matching deadlines in the next 2 weeks."
        emptyAction={{ label: "Browse all opportunities →", href: "/?sort=deadline_asc" }}
      />

      <Section
        title="Upcoming events"
        items={upcomingEvents}
        emptyMood="curious"
        emptyMessage="No upcoming events found."
        emptyAction={{ label: "Explore events →", href: "/?category=Event" }}
      />

      <TrackingDashboard />

      <Section
        title="Saved opportunities"
        items={savedItems}
        emptyMood="no-results"
        emptyMessage="Nothing saved yet."
        emptyAction={{ label: "Browse opportunities →", href: "/" }}
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
