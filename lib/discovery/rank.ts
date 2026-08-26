import { TrustTier } from "./contracts";

export const SCORE_VERSION = "2026-08-v1";

export function scoreOpportunity(input: { trustTier: TrustTier; completeness: number; resumeImpact?: number; learningPotential?: number; beginnerFriendly?: number; deadlineKind?: string | null }) {
  const trust = { official: 25, platform: 18, community: 10, unknown: 0 }[input.trustTier];
  const qualityScore = Math.max(0, Math.min(100, Math.round(trust + input.completeness * 0.75)));
  const enrichment = ((input.resumeImpact ?? 0) + (input.learningPotential ?? 0) + (input.beginnerFriendly ?? 0)) / 3;
  const deadlineBonus = input.deadlineKind === "verified" ? 8 : input.deadlineKind === "source_provided" ? 5 : 0;
  return { qualityScore, opportunityScore: Math.max(0, Math.min(100, Math.round(qualityScore * 0.55 + enrichment * 0.35 + deadlineBonus))), scoreVersion: SCORE_VERSION };
}
