import type { Document, Filter, Sort } from "mongodb";
import { CATEGORIES, Category } from "@/types/opportunity";

/** Legacy records without lifecycleStatus remain visible only when isActive is true. */
export function lifecycleFilter(showClosed: boolean): Filter<Document> {
  const active: Filter<Document> = {
    $or: [
      { lifecycleStatus: "active" },
      { lifecycleStatus: { $exists: false }, isActive: true },
    ],
  };
  if (!showClosed) return active;
  return {
    $and: [
      { $or: [{ lifecycleStatus: { $in: ["active", "closed"] } }, { lifecycleStatus: { $exists: false }, isActive: true }] },
      { lifecycleStatus: { $ne: "archived" } },
    ],
  };
}

const LOCATION_ALIASES: Record<string, string[]> = {
  bengaluru: ["bengaluru", "bangalore", "bengaluru, karnataka", "bangalore, karnataka"],
  remote: ["remote", "online", "work from home"],
  global: ["global", "worldwide", "international"],
};

function locationMatcher(location: string) {
  const normalized = location.trim().toLowerCase();
  const values = LOCATION_ALIASES[normalized] || [normalized];
  return { $regex: `^(${values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(,|$)`, $options: "i" };
}

/** Excludes only opportunities with a source-provided, definitively passed actionable date. */
function definitivelyClosedFilter(now: Date): Filter<Document> {
  return {
    $nor: [
      { deadlineKind: { $in: ["verified", "source_provided"] }, deadline: { $lt: now } },
      { applicationDeadline: { $type: "date", $lt: now } },
      { registrationDeadline: { $type: "date", $lt: now } },
      // An event is closed only when it ended and there is no separate action date.
      { eventEndDate: { $type: "date", $lt: now }, applicationDeadline: { $in: [null, undefined] }, registrationDeadline: { $in: [null, undefined] }, deadline: { $in: [null, undefined] } },
      { eventDate: { $type: "date", $lt: now }, eventEndDate: { $in: [null, undefined] }, applicationDeadline: { $in: [null, undefined] }, registrationDeadline: { $in: [null, undefined] }, deadline: { $in: [null, undefined] } },
    ],
  };
}

export function publicOpportunityFilter(params: {
  q?: string; category?: string | null; categories?: string; interests?: string; location?: string; tag?: string; remote?: string; experience?: string; showClosed: boolean;
}): Filter<Document> {
  const clauses: Filter<Document>[] = [lifecycleFilter(params.showClosed)];
  if (!params.showClosed) {
    clauses.push(definitivelyClosedFilter(new Date()));
    // Belt-and-suspenders: explicitly exclude closed opportunities
    // in case the lifecycle cron hasn't marked them yet.
    clauses.push({ lifecycleStatus: { $ne: "closed" } });
  }

  // Multi-category support: "Job,Internship" or single "Job"
  const categoryList = params.categories
    ? params.categories.split(",").map((c) => c.trim()).filter((c) => CATEGORIES.includes(c as Category))
    : params.category && CATEGORIES.includes(params.category as Category)
    ? [params.category]
    : [];
  if (categoryList.length === 1) {
    clauses.push({ category: categoryList[0] });
  } else if (categoryList.length > 1) {
    clauses.push({ category: { $in: categoryList } });
  }

  if (params.location) clauses.push({ location: locationMatcher(params.location) });
  if (params.tag) clauses.push({ tags: params.tag });
  if (params.remote === "true") clauses.push({ $or: [{ isRemote: true }, { location: { $regex: "^remote|^online", $options: "i" } }] });

  // Interests: comma-separated keywords matched against title, tags, description
  if (params.interests) {
    const interestList = params.interests.split(",").map((i) => i.trim()).filter(Boolean);
    if (interestList.length > 0) {
      const interestClauses = interestList.map((interest) => {
        const escaped = interest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return { $or: [
          { tags: { $regex: escaped, $options: "i" } },
          { title: { $regex: escaped, $options: "i" } },
          { description: { $regex: escaped, $options: "i" } },
        ] };
      });
      clauses.push({ $or: interestClauses });
    }
  }

  if (params.q) {
    const escaped = params.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({ $or: [{ title: { $regex: escaped, $options: "i" } }, { organization: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }, { tags: { $regex: escaped, $options: "i" } }] });
  }
  return { $and: clauses };
}

/**
 * Build a BROAD candidate query for two-stage retrieval.
 *
 * Stage 1 uses this to get candidates from MongoDB.
 * Stage 2 scores and ranks them server-side using the relevance engine.
 *
 * Key difference from publicOpportunityFilter:
 * - Does NOT filter by interests, location, or experience (those are scoring signals)
 * - Category IS a hard filter (user chose Internship → return internships)
 * - Remote is a soft preference (don't eliminate non-remote, just prefer them)
 */
export function buildCandidateFilter(params: {
  categories?: string[];
  remote?: boolean;
  q?: string;
}): Filter<Document> {
  const clauses: Filter<Document>[] = [
    lifecycleFilter(false),
    definitivelyClosedFilter(new Date()),
  ];

  // Category IS a hard filter
  if (params.categories && params.categories.length > 0) {
    const valid = params.categories.filter((c) => CATEGORIES.includes(c as Category));
    if (valid.length === 1) {
      clauses.push({ category: valid[0] });
    } else if (valid.length > 1) {
      clauses.push({ category: { $in: valid } });
    }
  }

  // Optional keyword search
  if (params.q) {
    const escaped = params.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({
      $or: [
        { title: { $regex: escaped, $options: "i" } },
        { organization: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { tags: { $regex: escaped, $options: "i" } },
      ],
    });
  }

  return { $and: clauses };
}

/**
 * Progressive fallback: if strict category match yields too few results,
 * relax constraints progressively.
 */
export function buildFallbackFilters(params: {
  categories?: string[];
  remote?: boolean;
  q?: string;
}): Filter<Document>[] {
  const fallbacks: Filter<Document>[] = [];

  // Level 1: exact categories (already handled by buildCandidateFilter)
  // Level 2: if category + interests + location gives too few, try just categories
  // Level 3: if still few, try broad active opportunities
  // Level 4: all active opportunities

  if (params.categories && params.categories.length > 0) {
    // Remove category constraint but keep lifecycle
    fallbacks.push({
      $and: [
        lifecycleFilter(false),
        definitivelyClosedFilter(new Date()),
      ],
    });
  }

  return fallbacks;
}

export function opportunitySort(sort: string): Sort {
  const sorts: Record<string, Sort> = {
    recommended: { opportunityScore: -1, qualityScore: -1, createdAt: -1 },
    score: { opportunityScore: -1, qualityScore: -1, createdAt: -1 },
    deadline_asc: { applicationDeadline: 1, registrationDeadline: 1, deadline: 1, createdAt: -1 },
    deadline_desc: { deadline: -1, createdAt: -1 },
    newest: { createdAt: -1 },
  };
  return sorts[sort] || sorts.recommended;
}
