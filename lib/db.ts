import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Category } from "@/types/opportunity";

// ── Opportunity Queries ─────────────────────────────────────────────────

export interface OpportunityFilters {
  q?: string;
  category?: Category;
  location?: string;
  tag?: string;
  remote?: boolean;
  showClosed?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Query opportunities from Supabase with filtering, search, and pagination.
 * This is the canonical server-side query function.
 */
export async function queryOpportunities(
  filters: OpportunityFilters
): Promise<PaginatedResult<any>> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 24));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("opportunities")
    .select("*", { count: "exact" });

  // Lifecycle filter
  if (filters.showClosed) {
    query = query.in("lifecycle_status", ["active", "closed"]);
  } else {
    query = query.eq("lifecycle_status", "active");
  }

  // Category filter
  if (filters.category && ["Job", "Internship", "Hackathon", "Fellowship", "Scholarship", "Grant", "Event"].includes(filters.category)) {
    query = query.eq("category", filters.category);
  }

  // Remote filter
  if (filters.remote) {
    query = query.or("is_remote.eq.true,location.ilike.%Remote%,location.ilike.%Online%");
  }

  // Location filter
  if (filters.location) {
    query = query.ilike("location", `%${filters.location}%`);
  }

  // Tag filter
  if (filters.tag) {
    query = query.contains("tags", [filters.tag]);
  }

  // Full-text search
  if (filters.q) {
    const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query = query.or(
      `title.ilike.%${escaped}%,organization.ilike.%${escaped}%,description.ilike.%${escaped}%`
    );
  }

  // Sorting
  switch (filters.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "deadline_asc":
      query = query.order("application_deadline", {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case "score":
      query = query.order("opportunity_score", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    default:
      // recommended: score descending, then created
      query = query.order("opportunity_score", {
        ascending: false,
        nullsFirst: false,
      });
      query = query.order("created_at", { ascending: false });
  }

  // Pagination
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("[DB] Query error:", error);
    return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  return {
    items: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
}

/**
 * Get a single opportunity by ID.
 */
export async function getOpportunity(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get live opportunities for the landing page.
 */
export async function getLiveOpportunities(limit: number = 6) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .eq("lifecycle_status", "active")
    .order("opportunity_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}

// ── Saved Opportunities ────────────────────────────────────────────────

export async function getSavedOpportunities(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_opportunities")
    .select("*, opportunities(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (data || []).map((s: any) => s.opportunities).filter(Boolean);
}

export async function saveOpportunity(userId: string, opportunityId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_opportunities")
    .insert({ user_id: userId, opportunity_id: opportunityId });

  return !error;
}

export async function unsaveOpportunity(userId: string, opportunityId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_opportunities")
    .delete()
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId);

  return !error;
}

export async function isSaved(userId: string, opportunityId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("saved_opportunities")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId);

  return (count || 0) > 0;
}

// ── Application Tracking ───────────────────────────────────────────────

export async function getApplicationTracking(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("application_tracking")
    .select("*, opportunities(*)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return data || [];
}

export async function upsertApplicationTracking(
  userId: string,
  opportunityId: string,
  status: string,
  notes?: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("application_tracking")
    .upsert(
      {
        user_id: userId,
        opportunity_id: opportunityId,
        status,
        notes: notes || null,
        applied_at: status === "applied" ? new Date().toISOString() : undefined,
      },
      { onConflict: "user_id,opportunity_id" }
    );

  return !error;
}

// ── Profile ────────────────────────────────────────────────────────────

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return data;
}

export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    experience_level?: string;
    location?: string;
    preferred_work_mode?: string;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  return !error;
}

// ── User Preferences ───────────────────────────────────────────────────

export async function getUserPreferences(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  return data;
}

export async function updateUserPreferences(
  userId: string,
  updates: {
    categories?: string[];
    interests?: string[];
    locations?: string[];
    remote?: boolean | null;
    experience_level?: string;
    language?: string;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return !error;
}

// ── Recently Viewed ────────────────────────────────────────────────────

export async function trackRecentlyViewed(userId: string, opportunityId: string) {
  const supabase = await createClient();
  await supabase.from("recently_viewed").insert({
    user_id: userId,
    opportunity_id: opportunityId,
  });
}

export async function getRecentlyViewed(userId: string, limit: number = 6) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recently_viewed")
    .select("*, opportunities(*)")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  return (data || []).map((r: any) => r.opportunities).filter(Boolean);
}

// ── Ingestion (service role) ───────────────────────────────────────────

export async function upsertOpportunity(doc: Record<string, any>) {
  const supabase = createServiceClient();

  // Check for existing by source_id + source_platform
  if (doc.source_id && doc.source_platform) {
    const { data: existing } = await supabase
      .from("opportunities")
      .select("id")
      .eq("source_id", doc.source_id)
      .eq("source_platform", doc.source_platform)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("opportunities")
        .update({ ...doc, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      return { inserted: false, updated: !error, id: existing.id };
    }
  }

  // Insert new
  const { data, error } = await supabase
    .from("opportunities")
    .insert(doc)
    .select("id")
    .single();

  return { inserted: !error, updated: false, id: data?.id };
}

export async function logIngestionRun(run: {
  source: string;
  started_at: string;
  completed_at?: string;
  status?: string;
  fetched?: number;
  published?: number;
  duplicates?: number;
  rejected?: number;
  error_message?: string;
  duration_ms?: number;
}) {
  const supabase = createServiceClient();
  await supabase.from("ingestion_runs").insert(run);
}

// ── Admin Queries (service role) ───────────────────────────────────────

export async function getAdminStats() {
  const supabase = createServiceClient();

  const [total, active, closed, archived] = await Promise.all([
    supabase.from("opportunities").select("*", { count: "exact", head: true }),
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("lifecycle_status", "active"),
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("lifecycle_status", "closed"),
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("lifecycle_status", "archived"),
  ]);

  return {
    total: total.count || 0,
    active: active.count || 0,
    closed: closed.count || 0,
    archived: archived.count || 0,
  };
}

export async function getSourceHealth() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("source_health")
    .select("*")
    .order("name");

  return data || [];
}

export async function getIngestionRuns(limit: number = 20) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ingestion_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getCandidates(limit: number = 50) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("discovery_candidates")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}
