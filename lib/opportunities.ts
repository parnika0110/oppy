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
  q?: string; category?: string | null; location?: string; tag?: string; showClosed: boolean;
}): Filter<Document> {
  const clauses: Filter<Document>[] = [lifecycleFilter(params.showClosed)];
  if (!params.showClosed) clauses.push(definitivelyClosedFilter(new Date()));
  if (params.category && CATEGORIES.includes(params.category as Category)) clauses.push({ category: params.category });
  if (params.location) clauses.push({ location: locationMatcher(params.location) });
  if (params.tag) clauses.push({ tags: params.tag });
  if (params.q) {
    const escaped = params.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({ $or: [{ title: { $regex: escaped, $options: "i" } }, { organization: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }, { tags: { $regex: escaped, $options: "i" } }] });
  }
  return { $and: clauses };
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
