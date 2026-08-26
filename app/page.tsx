import { Suspense } from "react";
import FilterBar from "@/components/FilterBar";
import OpportunityCard from "@/components/OpportunityCard";
import { OpportunityDocument } from "@/types/opportunity";
import { getOpportunitiesCollection } from "@/lib/mongodb";
import { publicOpportunityFilter, opportunitySort } from "@/lib/opportunities";

async function getOpportunities(searchParams: Record<string, string | undefined>) {
  const q = searchParams.q?.trim();
  const category = searchParams.category;
  const location = searchParams.location?.trim();
  const tag = searchParams.tag?.trim();
  const sort = searchParams.sort || "recommended";
  const showClosed = searchParams.showClosed === "true" || searchParams.showExpired === "true";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.limit || "24", 10)));

  const filter = publicOpportunityFilter({ q, category, location, tag, showClosed });
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { items, pagination } = await getOpportunities(params);
  const hasFilters = !!(params.q || params.category || params.location || params.tag || params.showClosed);

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      {!hasFilters && (
        <section className="mb-12 pt-4">
          <p className="eyebrow mb-3">Real opportunity discovery</p>
          <h1
            className="font-display font-semibold tracking-tight leading-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", color: "var(--ink)" }}
          >
            Find opportunities
            <br />
            <span style={{ color: "var(--lavender-deep)" }}>before everyone else.</span>
          </h1>
          <p
            className="mt-4 max-w-xl text-base leading-relaxed"
            style={{ color: "var(--ink-soft)" }}
          >
            OPPY surfaces real listings — internships, hackathons, fellowships, scholarships, and
            events — from traceable sources. Uncertain discoveries are held for review before
            reaching Browse.
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
              style={{ background: "var(--card)", border: "1px solid var(--line)" }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--sage-deep)" }}
              />
              <span className="font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
                {pagination.total} active opportunities
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── Filter Bar ────────────────────────────────────────────────── */}
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

      {/* ── Results header ────────────────────────────────────────────── */}
      <div className="mt-6 mb-4 flex items-center justify-between gap-4">
        <p className="eyebrow">
          {hasFilters
            ? `${pagination.total} result${pagination.total !== 1 ? "s" : ""}`
            : `${pagination.total} opportunities`}
        </p>
        {pagination.totalPages > 1 && (
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            Page {pagination.page} of {pagination.totalPages}
          </p>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
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

          {/* ── Pagination ────────────────────────────────────────────── */}
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
