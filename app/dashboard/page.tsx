import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/userAuth";
import { getOpportunitiesCollection, getSavedOpportunitiesCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import OpportunityCard from "@/components/OpportunityCard";
import { OpportunityDocument } from "@/types/opportunity";

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

  const [newOpportunities, closingSoon, upcomingEvents, savedLinks, activeCount] = await Promise.all([
    opportunities.find(activeFilter).sort({ discoveredAt: -1, createdAt: -1 }).limit(6).toArray(),
    opportunities
      .find({
        ...activeFilter,
        $and: [
          {
            $or: [
              { applicationDeadline: { $gte: now, $lte: in14Days } },
              { registrationDeadline: { $gte: now, $lte: in14Days } },
              { deadline: { $gte: now, $lte: in14Days }, deadlineKind: { $in: ["verified", "source_provided"] } },
            ],
          },
        ],
      })
      .limit(6)
      .toArray(),
    opportunities
      .find({ ...activeFilter, category: "Event", eventDate: { $gte: now } })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray(),
    saved.find({ userId }).sort({ savedAt: -1 }).limit(6).toArray(),
    opportunities.countDocuments(activeFilter),
  ]);

  let savedItems: OpportunityDocument[] = [];
  if (savedLinks.length > 0) {
    const ids = savedLinks
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
    savedItems = savedLinks
      .map((l) => byId.get(l.opportunityId))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map(serialize);
  }

  return {
    newOpportunities: newOpportunities.map(serialize),
    closingSoon: closingSoon.map(serialize),
    upcomingEvents: upcomingEvents.map(serialize),
    savedItems,
    activeCount,
  };
}

function Section({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: OpportunityDocument[];
}) {
  return (
    <section className="mb-10">
      <h2 className="font-display font-semibold mb-4" style={{ fontSize: "1.15rem", color: "var(--ink)" }}>
        {title}
      </h2>
      {items.length === 0 ? (
        <div
          className="py-10 px-6 text-center rounded-2xl text-sm"
          style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((opp) => (
            <OpportunityCard key={opp._id} opportunity={opp} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const { newOpportunities, closingSoon, upcomingEvents, savedItems, activeCount } = await getDashboardData(user.id);

  const firstName = user.name.split(" ")[0];

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
          <a
            href="/profile"
            className="mt-4 inline-block text-sm font-medium px-4 py-2 rounded-full"
            style={{ background: "var(--lavender)", color: "#4A3F8A", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Set your preferences for better recommendations →
          </a>
        )}
      </div>

      <Section
        title="New opportunities"
        items={newOpportunities}
        emptyMessage="No new opportunities yet. We'll surface them here as they're discovered."
      />

      <Section
        title="Closing soon"
        items={closingSoon}
        emptyMessage="Nothing closing in the next two weeks right now."
      />

      <Section
        title="Upcoming events"
        items={upcomingEvents}
        emptyMessage="No upcoming events discovered yet."
      />

      <Section
        title="Saved opportunities"
        items={savedItems}
        emptyMessage="You haven't saved anything yet. Browse opportunities and tap the bookmark icon."
      />
    </div>
  );
}
