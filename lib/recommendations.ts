import { SafeUser } from "@/lib/userAuth";
import { OpportunityDocument } from "@/types/opportunity";

/**
 * Deterministic, explainable recommendation scoring.
 *
 * personalizedScore =
 *   opportunityScore (base quality)
 *   + skill match
 *   + interest match
 *   + category match
 *   + location match
 *   + remote preference
 *   + experience fit
 *   + deadline relevance
 *
 * All weights are tuned so no single factor dominates.
 * The algorithm is fully deterministic — same inputs always produce the same output.
 */

export interface ScoredOpportunity {
  opportunity: OpportunityDocument;
  score: number;
  explanation: string[];
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function textOverlap(a: string[], b: string[]): number {
  const setA = new Set(a);
  let matches = 0;
  for (const token of b) {
    if (setA.has(token)) matches++;
  }
  return b.length > 0 ? matches / b.length : 0;
}

/**
 * Score an opportunity against a user's profile preferences.
 *
 * Returns a score from 0-100 and an array of human-readable explanations.
 */
export function scoreForUser(
  user: SafeUser,
  opp: OpportunityDocument,
  now: Date = new Date()
): ScoredOpportunity {
  const prefs = user.preferences || {};
  const explanation: string[] = [];
  let totalBonus = 0;

  // ── Base quality score ──────────────────────────────────────────────────
  const baseScore = opp.opportunityScore ?? 50;

  // ── Skill match (up to +15) ────────────────────────────────────────────
  const userSkills = (prefs.skills || []).map(normalizeText);
  if (userSkills.length > 0) {
    const oppTokens = [
      ...tokenize(opp.title),
      ...tokenize(opp.description),
      ...(opp.tags || []).map(normalizeText),
      ...tokenize(opp.organization),
    ];
    const overlap = textOverlap(userSkills, oppTokens);

    // Also do fuzzy substring matching for skills like "python" matching "python programming"
    let fuzzyMatches = 0;
    for (const skill of userSkills) {
      const skillLower = skill.toLowerCase();
      if (
        oppTokens.some((t) => t.includes(skillLower) || skillLower.includes(t)) ||
        opp.title.toLowerCase().includes(skillLower) ||
        opp.description.toLowerCase().includes(skillLower) ||
        (opp.tags || []).some((tag) => tag.toLowerCase().includes(skillLower))
      ) {
        fuzzyMatches++;
      }
    }
    const fuzzyScore = userSkills.length > 0 ? fuzzyMatches / userSkills.length : 0;
    const bestOverlap = Math.max(overlap, fuzzyScore);
    const skillBonus = Math.round(bestOverlap * 15);
    totalBonus += skillBonus;
    if (bestOverlap > 0.3) {
      const matchedSkills = userSkills.filter(
        (s) =>
          opp.title.toLowerCase().includes(s) ||
          opp.description.toLowerCase().includes(s) ||
          (opp.tags || []).some((t) => t.toLowerCase().includes(s))
      );
      if (matchedSkills.length > 0) {
        explanation.push(`Matches your ${matchedSkills.slice(0, 2).join(" & ")} skills`);
      }
    }
  }

  // ── Interest match (up to +12) ──────────────────────────────────────────
  const userInterests = (prefs.interests || []).map(normalizeText);
  if (userInterests.length > 0) {
    const oppText = [
      ...tokenize(opp.title),
      ...tokenize(opp.description),
      ...(opp.tags || []).map(normalizeText),
    ];
    let interestMatches = 0;
    const matchedInterests: string[] = [];
    for (const interest of userInterests) {
      if (
        oppText.some((t) => t.includes(interest) || interest.includes(t)) ||
        (opp.tags || []).some((tag) => tag.toLowerCase().includes(interest))
      ) {
        interestMatches++;
        matchedInterests.push(interest);
      }
    }
    const interestScore = interestMatches / userInterests.length;
    const interestBonus = Math.round(interestScore * 12);
    totalBonus += interestBonus;
    if (matchedInterests.length > 0) {
      explanation.push(`Matches your ${matchedInterests.slice(0, 2).join(" & ")} interests`);
    }
  }

  // ── Category match (up to +10) ──────────────────────────────────────────
  const userCategories = (prefs.categories || []).map(normalizeText);
  if (userCategories.length > 0) {
    const oppCategory = normalizeText(opp.category);
    if (userCategories.includes(oppCategory)) {
      totalBonus += 10;
      explanation.push(`${opp.category} category`);
    }
  }

  // ── Location match (up to +8) ───────────────────────────────────────────
  const userLocations = (prefs.locations || []).map(normalizeText);
  if (userLocations.length > 0) {
    const oppLocation = normalizeText(opp.location || "");
    const oppCity = normalizeText(opp.city || "");
    const oppCountry = normalizeText(opp.country || "");
    let locationMatch = false;

    for (const loc of userLocations) {
      if (
        oppLocation.includes(loc) ||
        oppCity.includes(loc) ||
        oppCountry.includes(loc) ||
        loc.includes(oppLocation)
      ) {
        locationMatch = true;
        break;
      }
    }

    if (locationMatch) {
      totalBonus += 8;
      explanation.push(`Matches your location preference`);
    }
  }

  // ── Remote preference (up to +6) ────────────────────────────────────────
  if (prefs.remote === true && (opp.isRemote || normalizeText(opp.location) === "remote" || normalizeText(opp.location) === "online")) {
    totalBonus += 6;
    explanation.push("Remote");
  }

  // ── Experience fit (up to +8) ───────────────────────────────────────────
  const userExperience = prefs.experience;
  if (userExperience) {
    const oppText = `${opp.title} ${opp.description}`.toLowerCase();
    const isBeginnerFriendly =
      oppText.includes("beginner") ||
      oppText.includes("first year") ||
      oppText.includes("freshman") ||
      oppText.includes("no experience") ||
      oppText.includes("no prior") ||
      oppText.includes("student") ||
      oppText.includes("undergraduate");
    const isAdvanced =
      oppText.includes("senior") ||
      oppText.includes("graduate") ||
      oppText.includes("experienced") ||
      oppText.includes("phd") ||
      oppText.includes("lead") ||
      oppText.includes("principal");

    if (userExperience === "Beginner" && isBeginnerFriendly) {
      totalBonus += 8;
      explanation.push("Beginner friendly");
    } else if (userExperience === "Advanced" && isAdvanced) {
      totalBonus += 6;
      explanation.push("Advanced level");
    } else if (userExperience === "Intermediate") {
      // Intermediate benefits from not being too entry-level or too senior
      if (!isBeginnerFriendly && !isAdvanced) {
        totalBonus += 4;
      }
    }
  }

  // ── Deadline relevance (up to +8) ───────────────────────────────────────
  const deadline = opp.applicationDeadline || opp.deadline;
  const deadlineKind = opp.deadlineKind;
  if (deadline && deadlineKind && ["verified", "source_provided"].includes(deadlineKind)) {
    const deadlineDate = new Date(deadline);
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft > 0 && daysLeft <= 14) {
      // Closing soon = more urgent = higher relevance
      const urgencyBonus = Math.max(2, 8 - Math.floor(daysLeft / 2));
      totalBonus += urgencyBonus;
      if (daysLeft <= 3) {
        explanation.push("Closing soon");
      } else if (daysLeft <= 7) {
        explanation.push(`${daysLeft} days left`);
      }
    }
  } else if (deadlineKind === "rolling") {
    totalBonus += 2;
    explanation.push("Rolling deadline");
  }

  // ── Final score ─────────────────────────────────────────────────────────
  const score = Math.max(0, Math.min(100, baseScore + totalBonus));

  // Default explanation if nothing matched
  if (explanation.length === 0) {
    if (baseScore >= 60) {
      explanation.push("High quality listing");
    } else {
      explanation.push("Recently discovered");
    }
  }

  return { opportunity: opp, score, explanation };
}

/**
 * Score and rank a list of opportunities for a user.
 * Returns them sorted by personalized score (descending).
 */
export function rankForUser(
  user: SafeUser,
  opportunities: OpportunityDocument[],
  limit: number = 6
): ScoredOpportunity[] {
  const scored = opportunities.map((opp) => scoreForUser(user, opp));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
