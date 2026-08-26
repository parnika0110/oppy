import { Category, DeadlineKind, SourcePlatform } from "@/types/opportunity";

export type TrustTier = "official" | "platform" | "community" | "unknown";
export type CandidateType = "opportunity" | "open_source_program" | "contribution_opportunity" | "github_issue" | "github_pr" | "informational";
export type CandidateState = "pending" | "needs_review" | "approved" | "rejected";

export interface DiscoveryEvidence {
  url: string;
  title?: string;
  excerpt?: string;
  fetchedAt: Date;
  provider: string;
  field?: string;
  method?: "feed" | "api" | "page" | "search" | "manual";
}

export interface DiscoveryCandidate {
  title: string;
  organization: string;
  url: string;
  sourcePlatform: SourcePlatform;
  sourceId: string;
  discoveredFrom: string;
  trustTier: TrustTier;
  candidateType: CandidateType;
  description?: string;
  category?: Category;
  location?: string;
  tags?: string[];
  deadline?: Date | null;
  deadlineKind?: DeadlineKind;
  eventUrl?: string;
  applicationUrl?: string;
  organizerUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  eventDate?: Date | null;
  eventEndDate?: Date | null;
  applicationDeadline?: Date | null;
  registrationDeadline?: Date | null;
  city?: string;
  country?: string;
  isRemote?: boolean;
  discoveryMethod?: string;
  discoveryQuery?: string;
  evidence: DiscoveryEvidence[];
}

export interface DiscoverySource {
  name: string;
  discover(): Promise<DiscoveryCandidate[]>;
}

export interface QualityResult {
  publishable: boolean;
  state: CandidateState;
  reasons: string[];
}
