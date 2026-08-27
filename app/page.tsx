import { Suspense } from "react";
import FilterBar from "@/components/FilterBar";
import RefinePanel from "@/components/RefinePanel";
import OpportunityCard from "@/components/OpportunityCard";
import LandingPage from "@/components/LandingPage";
import { OpportunityDocument } from "@/types/opportunity";
import { publicOpportunityFilter, opportunitySort, buildCandidateFilter } from "@/lib/opportunities";
import { getOpportunitiesCollection } from "@/lib/mongodb";
import { rankOpportunities, getMatchSummary, type DiscoveryPreferences } from "@/lib/relevance";

/** Parse URL params into DiscoveryPreferences. */
function parsePreferences(params: Record<string, string | undefined>): DiscoveryPreferences {
  const categories = params.categories?.split(",").map((c) => c.trim()).filter(Boolean) || [];
  const interests = params.interests?.split(",").map((i) => i.trim()).filter(Boolean) || [];
  return {
    categories: categories.length > 0 ? categories : undefined,
    interests: interests.length > 0 ? interests : undefined,
    location: params.location?.trim() || undefined,
    remote: params.remote === "true",
    experience: params.experience || undefined,
    q: params.q?.trim() || undefined,
  };
}

/** Two-stage: broad candidate retrieval + server-side relevance scoring. */
async function getRankedOpportunities(params: Record<string, string | undefined>) {
  const prefs = parsePreferences(params);
  const sort = params.sort || "recommended";
  const showClosed = params.showClosed === "true" || params.showExpired === "true";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(params.limit || "24", 10)));

  const hasPreferences = !!(prefs.categories?.length || prefs.interests?.length || prefs.location || prefs.remote || prefs.experience);

  // ── STAGE 1: Candidate retrieval ─────────────────────────────────
  // If we have preferences, use broad category filter (no interest/location/experience hard filters)
  // If no preferences, use the traditional filter system
  const collection = await getOpportunitiesCollection();

  if (hasPreferences) {
    // Two-stage: get candidates, then score them
    const candidateFilter = buildCandidateFilter({
      categories: prefs.categories,
      q: prefs.q,
    });

    // Retrieve a generous candidate set (more than we'll show, for scoring)
    const candidateLimit = Math.min(500, Math.max(limit * 10, 100));
    const candidates = await collection
      .find(candidateFilter)
      .sort(opportunitySort(sort))
      .limit(candidateLimit)
      .toArray();

    const serialized = candidates.map((item) => ({ ...item, _id: item._id.toString() })) as unknown as OpportunityDocument[];

    // ── STAGE 2: Relevance scoring + ranking ───────────────────────
    const ranked = rankOpportunities(serialized, prefs);

    // Apply total count from the candidate filter
    const totalCandidates = await collection.countDocuments(candidateFilter);

    // Paginate the ranked results
    const start = (page - 1) * limit;
    const paginated = ranked.slice(start, start + limit);

    const summary = getMatchSummary(ranked, prefs);

    return {
      items: paginated.map((r) => r.opportunity),
      pagination: {
        page,
        limit,
        total: ranked.length,
        totalPages: Math.ceil(ranked.length / limit),
      },
      summary,
      matchLabels: paginated.map((r) => r.matchLabels),
      matchLevels: paginated.map((r) => r.matchLevel),
      totalCandidates,
    };
  } else {
    // No preferences — use traditional filter
    const filter = publicOpportunityFilter({
      q: prefs.q,
      showClosed,
    });
    const sortSpec = opportunitySort(sort);

    const [items, total] = await Promise.all([
      collection.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(filter),
    ]);

    const serializedItems = items.map((item) => ({ ...item, _id: item._id.toString() }));

    return {
      items: serializedItems as unknown as OpportunityDocument[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: { message: `${total} ${total === 1 ? "opportunity" : "opportunities"} available`, level: "broad" as const, strongCount: 0, goodCount: 0, relatedCount: 0, broadCount: 0 },
      matchLabels: [],
      matchLevels: [],
      totalCandidates: total,
    };
  }
}

/** Traditional filter-based browse (for backward compatibility with ?q=&category=). */
async function getTraditionalFiltered(params: Record<string, string | undefined>) {
  const q = params.q?.trim();
  const category = params.category;
  const location = params.location?.trim();
  const tag = params.tag?.trim();
  const remote = params.remote;
  const sort = params.sort || "recommended";
  const showClosed = params.showClosed === "true" || params.showExpired === "true";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(params.limit || "24", 10)));

  const filter = publicOpportunityFilter({ q, category, showClosed });
  const sortSpec = opportunitySort(sort);

  const collection = await getOpportunitiesCollection();
  const [items, total] = await Promise.all([
    collection.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  const serializedItems = items.map((item) => ({ ...item, _id: item._id.toString() }));
  return {
    items: serializedItems as unknown as OpportunityDocument[],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Fetch the total active count from MongoDB. */
async function getActiveCount(): Promise<number> {
  try {
    const collection = await getOpportunitiesCollection();
    const activeFilter = {
      $or: [{ lifecycleStatus: "active" }, { lifecycleStatus: { $exists: false }, isActive: true }],
    };
    return await collection.countDocuments(activeFilter);
  } catch {
    return 0;
  }
}

/** Fetch a few live opportunities for the landing page "Fresh finds" section. */
async function getLandingOpps(): Promise<OpportunityDocument[]> {
  try {
    const collection = await getOpportunitiesCollection();
    const activeFilter = {
      $or: [{ lifecycleStatus: "active" }, { lifecycleStatus: { $exists: false }, isActive: true }],
    };
    const items = await collection
      .find(activeFilter)
      .sort({ opportunityScore: -1, createdAt: -1 })
      .limit(6)
      .toArray();
    return items.map((item) => ({ ...item, _id: item._id.toString() })) as unknown as OpportunityDocument[];
  } catch {
    return [];
  }
}

/** Build human-readable labels from URL params. */
function getActiveLabels(params: Record<string, string | undefined>): string[] {
  const labels: string[] = [];
  const cats = params.categories?.split(",").map((c) => c.trim()).filter(Boolean);
  if (cats && cats.length > 0) labels.push(...cats);
  else if (params.category) labels.push(params.category);
  const interests = params.interests?.split(",").map((i) => i.trim()).filter(Boolean);
  if (interests) labels.push(...interests);
  if (params.remote === "true") labels.push("Remote");
  if (params.location) labels.push(params.location);
  if (params.experience) labels.push(params.experience);
  return labels;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const hasPreferenceParams = !!(params.categories || params.interests || params.experience);
  const hasTraditionalFilters = !!(params.q || params.category || params.location || params.tag || (params.remote && !hasPreferenceParams) || params.showClosed || params.sort);
  const hasFilters = hasPreferenceParams || hasTraditionalFilters;

  // ── Landing page (no filters) ──────────────────────────────────
  if (!hasFilters) {
    const [liveOpps, activeCount] = await Promise.all([getLandingOpps(), getActiveCount()]);
    return <LandingPage liveOpps={liveOpps} activeCount={activeCount} />;
  }

  // ── Discovery results (preference-based) ───────────────────────
  if (hasPreferenceParams) {
    const { items, pagination, summary, matchLabels, matchLevels } = await getRankedOpportunities(params);
    const activeLabels = getActiveLabels(params);

    // Split into primary (strong/good/related) and fallback (broad) based on match levels
    // Exclude items explicitly marked as irrelevant (EXCLUDE level)
    const primaryItems: typeof items = [];
    const primaryLabels: string[][] = [];
    const secondaryItems: typeof items = [];
    const secondaryLabels: string[][] = [];
    for (let i = 0; i < items.length; i++) {
      const level = matchLevels[i] || 'broad';
      if (level === 'exclude') continue; // Filter out explicitly unrelated items
      if (level === 'strong' || level === 'good' || level === 'related') {
        primaryItems.push(items[i]);
        primaryLabels.push(matchLabels[i] || []);
      } else {
        if (secondaryItems.length < 12) { // Cap fallback section at 12
          secondaryItems.push(items[i]);
          secondaryLabels.push(matchLabels[i] || []);
        }
      }
    }
    const hasFallback = secondaryItems.length > 0;

    return (
      <div>
        {/* Preference summary header */}
        <div className="mb-6">
          <p className="eyebrow mb-2">Your discovery</p>
          <h1
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)", color: "var(--ink)" }}
          >
            {summary.message}
          </h1>
          {activeLabels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    background: "var(--lavender)",
                    color: "#4A3F8A",
                    border: "1px solid var(--lavender-deep)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          {summary.level === "related" && (
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              No exact matches — showing the closest results.
            </p>
          )}
          {summary.level === "broad" && (
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              Showing broader results since exact matches were limited.
            </p>
          )}
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)", fontFamily: "'JetBrains Mono', monospace" }}>
            Results ranked by relevance • Updated regularly from source platforms
          </p>
        </div>

        {/* Refine panel (collapsible) */}
        <Suspense
          fallback={
            <div
              className="h-16 rounded-2xl skeleton mb-4"
              style={{ border: "1px solid var(--line)" }}
            />
          }
        >
          <RefinePanel />
        </Suspense>

        <div className="mt-4 mb-4 flex items-center justify-between gap-4">
          <p className="eyebrow">
            {pagination.total} result{pagination.total !== 1 ? "s" : ""}
          </p>
          {pagination.totalPages > 1 && (
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              Page {pagination.page} of {pagination.totalPages}
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div
            className="mt-8 py-20 text-center rounded-2xl"
            style={{ background: "var(--card)", border: "1px solid var(--line)" }}
          >
            <p className="font-display font-semibold text-lg" style={{ color: "var(--ink)" }}>
              No opportunities found
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              Try broadening your preferences or clearing some filters.
            </p>
            <a
              href="/"
              className="mt-5 inline-block text-sm font-medium px-4 py-2 rounded-full"
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Start over
            </a>
          </div>
        ) : (
          <>
            {/* Best matches section */}
            {primaryItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {primaryItems.map((opp, pIdx) => (
                  <div key={opp._id} className="relative">
                    {primaryLabels[pIdx] && primaryLabels[pIdx].length > 0 && (
                      <div className="absolute left-3 top-3 z-10">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-medium"
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            background: "rgba(255,255,255,0.92)",
                            color: "var(--lavender-deep)",
                            border: "1px solid var(--lavender)",
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          {primaryLabels[pIdx].slice(0, 2).join(" · ")}
                        </span>
                      </div>
                    )}
                    <OpportunityCard opportunity={opp} />
                  </div>
                ))}
              </div>
            )}

            {/* Broader results section */}
            {hasFallback && (
              <>
                <div className="mt-8 mb-4 flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: "var(--line)" }} />
                  <p className="eyebrow whitespace-nowrap">You might also like</p>
                  <div className="h-px flex-1" style={{ background: "var(--line)" }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {secondaryItems.map((opp, sIdx) => (
                    <div key={opp._id} className="relative">
                      {secondaryLabels[sIdx] && secondaryLabels[sIdx].length > 0 && (
                        <div className="absolute left-3 top-3 z-10">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-medium"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              background: "rgba(255,255,255,0.85)",
                              color: "#6B7280",
                              border: "1px solid #E5E7EB",
                              backdropFilter: "blur(4px)",
                            }}
                          >
                            {secondaryLabels[sIdx].slice(0, 2).join(" · ")}
                          </span>
                        </div>
                      )}
                      <OpportunityCard opportunity={opp} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {pagination.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                {pagination.page > 1 && (
                  <a
                    href={`/?${new URLSearchParams({ ...params, page: String(pagination.page - 1) })}`}
                    className="px-4 py-2 rounded-full text-sm font-medium"
                    style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
                  >
                    ← Previous
                  </a>
                )}
                <span className="eyebrow">
                  {pagination.page} / {pagination.totalPages}
                </span>
                {pagination.page < pagination.totalPages && (
                  <a
                    href={`/?${new URLSearchParams({ ...params, page: String(pagination.page + 1) })}`}
                    className="px-4 py-2 rounded-full text-sm font-medium"
                    style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
                  >
                    Next →
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Traditional browse (backward-compatible ?q=&category=) ──────
  const { items, pagination } = await getTraditionalFiltered(params);

  return (
    <div>
      <Suspense
        fallback={
          <div
            className="h-24 rounded-2xl skeleton"
            style={{ border: "1px solid var(--line)" }}
          />
        }
      >
        <FilterBar />
      </Suspense>

      <div className="mt-6 mb-4 flex items-center justify-between gap-4">
        <p className="eyebrow">
          {pagination.total} result{pagination.total !== 1 ? "s" : ""}
        </p>
        {pagination.totalPages > 1 && (
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            Page {pagination.page} of {pagination.totalPages}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="mt-8 py-20 text-center rounded-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--line)" }}
        >
          <p className="font-display font-semibold text-lg" style={{ color: "var(--ink)" }}>
            No opportunities found
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            Try broadening your search or clearing some filters.
          </p>
          <a
            href="/"
            className="mt-5 inline-block text-sm font-medium px-4 py-2 rounded-full"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Clear filters
          </a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((opp) => (
              <OpportunityCard key={opp._id} opportunity={opp} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              {pagination.page > 1 && (
                <a
                  href={`/?${new URLSearchParams({ ...params, page: String(pagination.page - 1) })}`}
                  className="px-4 py-2 rounded-full text-sm font-medium"
                  style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
                >
                  ← Previous
                </a>
              )}
              <span className="eyebrow">
                {pagination.page} / {pagination.totalPages}
              </span>
              {pagination.page < pagination.totalPages && (
                <a
                  href={`/?${new URLSearchParams({ ...params, page: String(pagination.page + 1) })}`}
                  className="px-4 py-2 rounded-full text-sm font-medium"
                  style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
