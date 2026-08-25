import { Suspense } from "react";
import FilterBar from "@/components/FilterBar";
import OpportunityCard from "@/components/OpportunityCard";
import { OpportunityDocument } from "@/types/opportunity";

import { getOpportunitiesCollection } from "@/lib/mongodb";
import { Category, CATEGORIES } from "@/types/opportunity";
import type { Filter, Document, Sort } from "mongodb";

async function getOpportunities(searchParams: Record<string, string | undefined>) {
  const q = searchParams.q?.trim();
  const category = searchParams.category as Category | undefined;
  const location = searchParams.location?.trim();
  const tag = searchParams.tag?.trim();
  const sort = searchParams.sort || "newest";
  const showExpired = searchParams.showExpired === "true";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.limit || "20", 10)));

  const filter: Filter<Document> = { isActive: true };

  if (!showExpired) {
      filter.$or = [
        { deadlineKind: { $in: ["verified", "source_provided"] }, deadline: { $gte: new Date() } },
        { deadlineKind: { $in: ["rolling", "unavailable"] } },
        { deadlineKind: { $exists: false } },
        { deadline: null },
        { deadline: { $exists: false } },
      ];
  }

  if (category && CATEGORIES.includes(category)) {
    filter.category = category;
  }

  if (location) {
    filter.location = location;
  }

  if (tag) {
    filter.tags = tag;
  }

  if (q) {
    filter.$text = { $search: q };
  }

  const sortMap: Record<string, Sort> = {
    deadline_asc: { deadline: 1 },
    deadline_desc: { deadline: -1 },
    newest: { createdAt: -1 },
  };
  const sortSpec = sortMap[sort] || sortMap.deadline_asc;

  const collection = await getOpportunitiesCollection();

  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  // Convert MongoDB ObjectIds to strings to avoid Next.js RSC serialization errors
  const serializedItems = items.map((item) => ({
    ...item,
    _id: item._id.toString(),
  }));

  return {
    items: serializedItems as unknown as OpportunityDocument[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { items, pagination } = await getOpportunities(params);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Browse Opportunities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Never miss an opportunity because you found it too late.
        </p>
      </div>

      <Suspense fallback={<div className="h-32 bg-white rounded-xl border border-gray-200" />}>
        <FilterBar />
      </Suspense>

      <p className="text-sm text-gray-500">{pagination.total} opportunities found</p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No opportunities match your filters. Try broadening your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((opp) => (
            <OpportunityCard key={opp._id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
