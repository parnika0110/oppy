export type Category =
  | "Internship"
  | "Hackathon"
  | "Fellowship"
  | "Scholarship"
  | "Grant"
  | "Event";

export const CATEGORIES: Category[] = [
  "Internship",
  "Hackathon",
  "Fellowship",
  "Scholarship",
  "Grant",
  "Event",
];

export type DeadlineKind = "verified" | "source_provided" | "rolling" | "unavailable";

export type SourcePlatform =
  | "Devpost"
  | "Devfolio"
  | "Unstop"
  | "Lu.ma"
  | "Eventbrite"
  | "Google"
  | "Microsoft"
  | "GitHub"
  | "Internshala"
  | "Fellowship"
  | "YCombinator"
  | "AWS"
  | "Other";

// Location is free-ish text but we suggest common values in the admin UI.
export const COMMON_LOCATIONS = ["Remote", "Global", "India", "Bengaluru"];

export const COMMON_TAGS = [
  "AI",
  "Web Development",
  "Open Source",
  "Research",
  "Design",
  "Data Science",
  "Cybersecurity",
  "Product Management",
];

export type UrgencyTier = "normal" | "warning" | "critical" | "expired";

export interface AISummary {
  summary: string;
  eligibility: string[];
  keyDates: string[];
  takeaways: string[];
  suggestedTags: string[];
  generatedAt: string; // ISO date string
}

/**
 * Result of the AI's category-validation pass at ingestion time.
 * e.g. admin selects "Hackathon" but the description reads like a Fellowship.
 */
export interface CategoryValidation {
  isConsistent: boolean;
  suggestedCategory: Category | null;
  reasoning: string;
}

// Shape as stored in MongoDB (dates are real Date objects server-side)
export interface OpportunityDocument {
  _id: string;
  title: string;
  organization: string;
  category: Category;
  location: string;
  tags: string[];
  description: string;
  applicationLink: string;
  imageUrl?: string | null;
  deadline: string | null; // ISO date string over the wire when known
  deadlineKind: DeadlineKind;
  deadlineLastVerifiedAt?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  sourcePlatform?: SourcePlatform | null;
  sourceId?: string | null;
  lastSeenAt?: string | null;
  firstSeenAt?: string | null;
  aiSummary: AISummary | null;
  categoryValidation: CategoryValidation | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Payload the admin ingestion form submits (pre-AI-enrichment)
export interface CreateOpportunityInput {
  title: string;
  organization: string;
  category: Category;
  location: string;
  tags?: string[];
  description: string;
  applicationLink: string;
  imageUrl?: string;
  deadline?: string | null; // ISO date string; omitted when the source has no deadline
  deadlineKind?: DeadlineKind;
  source?: string;
  sourceUrl?: string;
}

/**
 * Raw opportunity shape returned by source adapters.
 * Extends CreateOpportunityInput with ingestion-tracking fields.
 */
export interface RawOpportunity extends Omit<CreateOpportunityInput, "deadline"> {
  deadline?: Date | string | null;
  sourcePlatform: SourcePlatform;
  sourceId?: string; // Unique ID from the source platform (e.g. Devpost slug)
}

/**
 * Standard interface every source adapter must implement.
 */
export interface OpportunitySource {
  name: string;
  platform: SourcePlatform;
  fetch(): Promise<RawOpportunity[]>;
}

// Query params accepted by GET /api/opportunities
export interface OpportunityQuery {
  q?: string;              // keyword search
  category?: Category;
  location?: string;
  tag?: string;
  sort?: "deadline_asc" | "deadline_desc" | "newest";
  showExpired?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Schema for the ingestionRuns collection — tracks every pipeline execution.
 */
export interface IngestionRun {
  startedAt: string;
  completedAt: string;
  source: string;
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: string[];
}
