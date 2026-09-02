/**
 * OPPY Relevance Scoring Engine v2
 *
 * Hard/soft preference semantics:
 *   - Category + Remote + Location = hard constraints (when explicitly selected)
 *   - Interests + Experience = strong ranking signals
 *   - Related interests + nearby locations = soft fallback
 *
 * Stage 1: Broad candidate retrieval from MongoDB
 * Stage 2: Server-side relevance scoring + ranking
 */

import { textMatchesInterest, textContainsKeyword, isStudentRelevant, isProfessionalRelevant, INTEREST_TAXONOMY } from "./interests";
import { normalizeLocation, locationCompatibility } from "./location-normalize";
import type { OpportunityDocument } from "@/types/opportunity";

// ── Types ────────────────────────────────────────────────────────────────

export interface DiscoveryPreferences {
  categories?: string[];
  interests?: string[];
  skills?: string[];
  location?: string;
  remote?: boolean;
  experience?: string;
  q?: string;
  // Resume-derived signals (lower weight than explicit preferences)
  resumeSkills?: string[];
  resumeInterests?: string[];
  resumeDomains?: string[];
}

export interface RelevanceScore {
  total: number;
  category: number;
  interests: number;
  location: number;
  experience: number;
  freshness: number;
}

export type MatchLevel = "strong" | "good" | "related" | "broad" | "exclude";

export interface RankedOpportunity {
  opportunity: OpportunityDocument;
  score: RelevanceScore;
  matchLevel: MatchLevel;
  matchLabels: string[];
}

// ── Category relatedness ─────────────────────────────────────────────────

const CATEGORY_RELATEDNESS: Record<string, string[]> = {
  Internship: ["Job", "Fellowship"],
  Job: ["Internship", "Fellowship"],
  Hackathon: ["Event", "Grant"],
  Event: ["Hackathon"],
  Fellowship: ["Internship", "Grant", "Scholarship"],
  Grant: ["Fellowship", "Scholarship"],
  Scholarship: ["Fellowship", "Grant"],
};

// ── Negative interest signals ────────────────────────────────────────────
// Words in title/description that strongly indicate an opportunity is NOT
// relevant when specific interests are requested.

const UNRELATED_KEYWORDS: Record<string, string[]> = {
  "AI / ML": [
    "sales", "marketing", "hr", "human resources", "content writing",
    "content writer", "editorial", "graphic design", "graphic designer",
    "video editing", "video editor", "retail",
    "customer service", "talent acquisition", "business development",
    "architecture", "real estate", "finance accounting",
    "telecalling", "recruitment", "procurement", "merchandise",
    "e-commerce operations", "business operations", "community outreach",
    "patient experience", "digital marketing",
    "sales support", "sales and marketing",
  ],
  "Software Engineering": [
    "sales", "marketing", "hr", "human resources", "content writing",
    "graphic design", "retail", "customer service", "talent acquisition",
    "telecalling", "recruitment", "procurement", "merchandise",
    "architecture", "editorial", "digital marketing",
  ],
  "Web Development": [
    "sales", "marketing", "hr", "human resources", "graphic design",
    "retail", "customer service", "talent acquisition", "real estate",
    "telecalling", "recruitment", "procurement", "merchandise",
    "architecture", "editorial",
  ],
  "Data Science": [
    "sales", "marketing", "hr", "human resources", "retail",
    "customer service", "talent acquisition", "graphic design",
    "telecalling", "recruitment", "procurement",
  ],
};

// ── Core scoring ─────────────────────────────────────────────────────────

export function scoreOpportunity(
  opp: OpportunityDocument,
  prefs: DiscoveryPreferences
): RelevanceScore {
  let category = 0;
  let interests = 0;
  let location = 0;
  let experience = 0;
  let freshness = 0;

  // ── CATEGORY: +30 exact, +10 related, -20 penalty ────────────────────
  if (prefs.categories && prefs.categories.length > 0) {
    if (prefs.categories.includes(opp.category)) {
      category = 30;
    } else {
      const related = CATEGORY_RELATEDNESS[opp.category] || [];
      const isRelated = prefs.categories.some(c => related.includes(c));
      category = isRelated ? 10 : -25; // Strong penalty for wrong categories
    }
  } else {
    category = 5; // Baseline when no category selected
  }

  // ── INTERESTS: strong signal with penalty for mismatches ──────────────
  if (prefs.interests && prefs.interests.length > 0) {
    const oppText = `${opp.title} ${(opp.tags || []).join(" ")} ${opp.description || ""} ${opp.organization || ""}`.toLowerCase();

    let maxInterestScore = 0;
    let hasUnrelatedPenalty = false;

    for (const interest of prefs.interests) {
      const titleMatch = textMatchesInterest(opp.title, interest);
      const tagStrong = opp.tags?.some(t => textMatchesInterest(t, interest) === "strong") ?? false;
      const tagRelated = opp.tags?.some(t => textMatchesInterest(t, interest) === "related") ?? false;
      const descMatch = textMatchesInterest(opp.description, interest);
      const orgMatch = opp.organization ? textMatchesInterest(opp.organization, interest) : "none";

      let thisInterest = 0;
      if (titleMatch === "strong") thisInterest = 30;
      else if (tagStrong) thisInterest = 25;
      else if (descMatch === "strong" || orgMatch === "strong") thisInterest = 18;
      else if (titleMatch === "related" || tagRelated || descMatch === "related") thisInterest = 8;
      else {
        // Check keywords in full text
        const def = INTEREST_TAXONOMY[interest];
        if (def) {
          for (const kw of def.keywords) {
            if (textContainsKeyword(oppText, kw)) { thisInterest = 5; break; }
          }
        } else if (interest.length >= 3) {
          // Custom/Other interest: use the raw interest text as a direct match.
          // This makes user-typed interests functional even when not in the taxonomy.
          const lowerInterest = interest.toLowerCase();
          if (oppText.includes(lowerInterest)) {
            thisInterest = 12; // Stronger than taxonomy keyword match (5) since user declared it
          }
        }
      }

      maxInterestScore = Math.max(maxInterestScore, thisInterest);

      // Check for unrelated penalties
      const penalties = UNRELATED_KEYWORDS[interest] || [];
      for (const neg of penalties) {
        if (textContainsKeyword(oppText, neg)) {
          hasUnrelatedPenalty = true;
          break;
        }
      }
      if (hasUnrelatedPenalty) break;
    }

    if (hasUnrelatedPenalty && maxInterestScore < 10) {
      interests = -30; // Severe penalty: unrelated opportunity with no interest match
    } else if (maxInterestScore === 0 && prefs.interests && prefs.interests.length > 0) {
      interests = -15; // Significant penalty: no interest match when interests were explicitly requested
    } else {
      interests = maxInterestScore;
    }
  } else {
    interests = 3; // Baseline when no interests selected
  }

  // ── SKILLS: additional interest-like signal from user's declared skills ──
  // Skills are not in the interest taxonomy but should boost matching opportunities.
  // Only applied when interests were NOT already providing a strong signal.
  if (prefs.skills && prefs.skills.length > 0 && interests < 10) {
    const oppText = `${opp.title} ${(opp.tags || []).join(" ")} ${opp.description || ""} ${opp.organization || ""}`.toLowerCase();
    let maxSkillScore = 0;
    for (const skill of prefs.skills) {
      const skillLower = skill.toLowerCase().trim();
      if (!skillLower || skillLower.length < 2) continue;
      // Direct substring match in title/tags gets high score
      const titleHit = opp.title.toLowerCase().includes(skillLower);
      const tagHit = opp.tags?.some(t => t.toLowerCase().includes(skillLower)) ?? false;
      if (titleHit) maxSkillScore = Math.max(maxSkillScore, 20);
      else if (tagHit) maxSkillScore = Math.max(maxSkillScore, 15);
      else if (oppText.includes(skillLower)) maxSkillScore = Math.max(maxSkillScore, 8);
      // Also check taxonomy keywords that map to this skill
      for (const [, def] of Object.entries(INTEREST_TAXONOMY)) {
        if (def.keywords.some(kw => kw === skillLower || skillLower.includes(kw))) {
          // Skill maps to a taxonomy interest — check if opportunity matches those keywords
          for (const kw of def.keywords.slice(0, 8)) {
            if (textContainsKeyword(oppText, kw)) { maxSkillScore = Math.max(maxSkillScore, 10); break; }
          }
        }
      }
    }
    if (maxSkillScore > interests) interests = maxSkillScore;
  }

  // ── RESUME SIGNALS: supplementary matching from parsed resume ─────────
  // Resume-derived signals have lower weight than explicit user preferences.
  // They provide context but never override explicit choices.
  if (interests < 15 && (prefs.resumeSkills?.length || prefs.resumeInterests?.length || prefs.resumeDomains?.length)) {
    const oppText = `${opp.title} ${(opp.tags || []).join(" ")} ${opp.description || ""} ${opp.organization || ""}`.toLowerCase();
    let resumeScore = 0;

    // Resume skills (weight: up to 10)
    if (prefs.resumeSkills) {
      for (const skill of prefs.resumeSkills) {
        const skillLower = skill.toLowerCase();
        if (opp.title.toLowerCase().includes(skillLower)) resumeScore = Math.max(resumeScore, 10);
        else if (opp.tags?.some(t => t.toLowerCase().includes(skillLower))) resumeScore = Math.max(resumeScore, 8);
        else if (oppText.includes(skillLower)) resumeScore = Math.max(resumeScore, 5);
      }
    }

    // Resume interests (weight: up to 8)
    if (prefs.resumeInterests) {
      for (const interest of prefs.resumeInterests) {
        const match = textMatchesInterest(oppText, interest);
        if (match === "strong") resumeScore = Math.max(resumeScore, 8);
        else if (match === "related") resumeScore = Math.max(resumeScore, 5);
      }
    }

    // Resume domains (weight: up to 6)
    if (prefs.resumeDomains) {
      for (const domain of prefs.resumeDomains) {
        const domainLower = domain.toLowerCase();
        if (oppText.includes(domainLower)) resumeScore = Math.max(resumeScore, 6);
      }
    }

    // Only boost if resume signal is meaningful and doesn't conflict with explicit
    if (resumeScore > interests) interests = resumeScore;
  }

  // ── LOCATION: proper hierarchy with explicit preference respect ───────
  const hasExplicitLocation = Boolean(prefs.location);

  if (hasExplicitLocation) {
    const userLoc = normalizeLocation(prefs.location!);
    const oppLoc = normalizeLocation(opp.location || "");
    const locCompat = locationCompatibility(oppLoc, userLoc);

    // Score based on compatibility level
    switch (locCompat.level) {
      case "exact_city": location = 25; break;
      case "exact_state": location = 22; break;
      case "exact_country": location = 18; break;
      case "remote_compatible": location = 15; break;
      case "global": location = 5; break;
      case "different_country": location = prefs.remote ? 0 : -10; break;
      case "none": location = 0; break;
    }

    // Bonus for remote when explicitly requested
    if (prefs.remote) {
      const isRemote = opp.isRemote || (opp.location && /remote|online|work from home/i.test(opp.location));
      if (isRemote) location += 8;
      else location -= 5; // Penalty: in-person when remote was requested
    }
  } else if (prefs.remote) {
    // Remote requested but no specific location
    const isRemote = opp.isRemote || (opp.location && /remote|online|work from home/i.test(opp.location));
    location = isRemote ? 15 : -5;
  } else {
    location = 3; // Baseline
  }

  // ── EXPERIENCE: ranking signal ────────────────────────────────────────
  // Normalize both onboarding labels and legacy labels
  const exp = (prefs.experience || "").toLowerCase();
  const isStudent = exp === "student" || exp === "beginner";
  const isProfessional = exp === "working professional" || exp === "advanced";
  const isRecentGrad = exp === "recent graduate" || exp === "intermediate";

  if (isStudent) {
    experience = isStudentRelevant(opp) ? 10 : 0;
  } else if (isProfessional) {
    experience = isProfessionalRelevant(opp) ? 10 : 3;
  } else if (isRecentGrad) {
    experience = (isStudentRelevant(opp) || isProfessionalRelevant(opp)) ? 8 : 3;
  } else {
    experience = 3;
  }

  // ── FRESHNESS: tiny tiebreaker only ──────────────────────────────────
  if (opp.createdAt) {
    const ageDays = (Date.now() - new Date(opp.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 1) freshness = 3;
    else if (ageDays < 3) freshness = 2;
    else if (ageDays < 7) freshness = 1;
  }

  return {
    total: category + interests + location + experience + freshness,
    category, interests, location, experience, freshness,
  };
}

// ── Match level determination ─────────────────────────────────────────────

export function getMatchLevel(score: RelevanceScore, prefs: DiscoveryPreferences): MatchLevel {
  const hasInterests = Boolean(prefs.interests?.length);
  const hasLocation = Boolean(prefs.location) || prefs.remote;

  const catOk = score.category >= 30;
  const intStrong = score.interests >= 18;
  const intWeak = score.interests > 0 && score.interests < 18;
  const intPenalized = score.interests <= -30;
  const intBadlyPenalized = score.interests <= -15;
  const locOk = score.location >= 10;

  // EXCLUDE: explicitly unrelated when interests were requested AND category is wrong or strongly penalized
  if (hasInterests && intPenalized && (!catOk || score.category <= -20)) {
    return "exclude";
  }
  // EXCLUDE: category is wrong AND interests are penalized
  if (hasInterests && intPenalized && score.category < 10) {
    return "exclude";
  }

  // STRONG: category + strong interest + (location when requested)
  if (catOk && intStrong && (!hasLocation || locOk)) {
    return "strong";
  }
  // GOOD: category + strong interest (even if location not matching)
  if (catOk && intStrong) {
    return "good";
  }
  // RELATED: category matches + compatible location + not penalized
  if (catOk && locOk && !intPenalized) {
    return "related";
  }
  // RELATED: category matches + weak positive interest signal
  if (catOk && intWeak && !intBadlyPenalized) {
    return "related";
  }
  // RELATED: category matches + student/professional relevance
  if (catOk && score.experience >= 10 && !intPenalized) {
    return "related";
  }
  // BROAD: category matches but no meaningful preference alignment
  return "broad";
}

// ── Match labels ─────────────────────────────────────────────────────────

export function getMatchLabels(score: RelevanceScore, prefs: DiscoveryPreferences): string[] {
  const labels: string[] = [];

  // Don't generate labels for excluded items
  if (score.interests <= -30 && score.category < 10) return [];

  if (score.category >= 30 && prefs.categories?.length) {
    labels.push(prefs.categories.length === 1 ? prefs.categories[0] : "Matching category");
  }

  if (score.interests >= 18 && prefs.interests?.length) {
    // Show actual matched interest names
    for (const interest of prefs.interests.slice(0, 2)) {
      labels.push(interest);
    }
  }

  if (prefs.remote && score.location >= 10) {
    labels.push("Remote");
  }

  if (prefs.location && score.location >= 15) {
    labels.push(prefs.location!);
  }

  if ((prefs.experience === "Student" || prefs.experience === "Beginner") && score.experience >= 8) {
    labels.push("Student friendly");
  }

  return labels.slice(0, 3);
}

// ── Ranking ──────────────────────────────────────────────────────────────

export function rankOpportunities(
  candidates: OpportunityDocument[],
  prefs: DiscoveryPreferences
): RankedOpportunity[] {
  const ranked = candidates.map(opp => {
    const score = scoreOpportunity(opp, prefs);
    const matchLevel = getMatchLevel(score, prefs);
    const matchLabels = getMatchLabels(score, prefs);
    return { opportunity: opp, score, matchLevel, matchLabels };
  });

  // Filter out EXCLUDE items
  const filtered = ranked.filter(r => r.matchLevel !== "exclude");

  // Sort: total DESC → category DESC → interests DESC → createdAt DESC
  filtered.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    if (b.score.category !== a.score.category) return b.score.category - a.score.category;
    if (b.score.interests !== a.score.interests) return b.score.interests - a.score.interests;
    const dateA = a.opportunity.createdAt ? new Date(a.opportunity.createdAt).getTime() : 0;
    const dateB = b.opportunity.createdAt ? new Date(b.opportunity.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  return filtered;
}

// ── Match summary ────────────────────────────────────────────────────────

export function getMatchSummary(
  ranked: RankedOpportunity[],
  prefs: DiscoveryPreferences
): { message: string; level: MatchLevel; strongCount: number; goodCount: number; relatedCount: number; broadCount: number } {
  // Filter out excluded items from the summary
  const visible = ranked.filter(r => r.matchLevel !== "exclude");

  if (visible.length === 0) {
    return { message: "No opportunities found. Try broadening your search.", level: "broad", strongCount: 0, goodCount: 0, relatedCount: 0, broadCount: 0 };
  }

  const strongCount = visible.filter(r => r.matchLevel === "strong").length;
  const goodCount = visible.filter(r => r.matchLevel === "good").length;
  const relatedCount = visible.filter(r => r.matchLevel === "related").length;
  const broadCount = visible.filter(r => r.matchLevel === "broad").length;

  if (strongCount >= 5) {
    return { message: `${strongCount} strong matches for you`, level: "strong", strongCount, goodCount, relatedCount, broadCount };
  }
  if (strongCount + goodCount >= 3) {
    const parts: string[] = [];
    if (strongCount > 0) parts.push(`${strongCount} strong`);
    if (goodCount > 0) parts.push(`${goodCount} good`);
    return { message: `${parts.join(" + ")} matches`, level: "good", strongCount, goodCount, relatedCount, broadCount };
  }
  if (relatedCount >= 2) {
    return { message: `${strongCount + goodCount + relatedCount} related opportunities`, level: "related", strongCount, goodCount, relatedCount, broadCount };
  }

  // Check if we broadened
  const hasPrefs = Boolean(prefs.categories?.length || prefs.interests?.length || prefs.location || prefs.remote);
  if (hasPrefs) {
    return { message: `${visible.length} opportunities — broadened search to find these`, level: "broad", strongCount, goodCount, relatedCount, broadCount };
  }

  return { message: `${visible.length} opportunities available`, level: "broad", strongCount, goodCount, relatedCount, broadCount };
}
