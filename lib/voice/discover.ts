/**
 * Voice discovery — connects an interpreted query to OPPY's REAL discovery
 * system (MongoDB + the existing relevance engine). No mock catalogue, no
 * second ranking system: this module is a thin adapter over the exact same
 * building blocks app/page.tsx uses for browse search.
 *
 *   buildCandidateFilter / publicOpportunityFilter  → broad candidate retrieval
 *   rankOpportunities (lib/relevance.ts)            → scoring + match levels
 *   getMatchSummary                                  → human-readable summary
 *
 * Output is grouped, capped and annotated for the voice results UI, with a
 * localized spoken summary for Gnani Timbre / browser speechSynthesis.
 */

import { getOpportunitiesCollection } from "@/lib/mongodb";
import {
  buildCandidateFilter,
  opportunitySort,
  publicOpportunityFilter,
} from "@/lib/opportunities";
import {
  getMatchSummary,
  rankOpportunities,
  type DiscoveryPreferences,
  type RankedOpportunity,
} from "@/lib/relevance";
import { getEmptySpokenSummary } from "@/lib/voice/mock";
import type { OpportunityDocument } from "@/types/opportunity";
import type {
  VoicePreferences,
  VoiceResultGroup,
  VoiceResultItem,
} from "@/types/voice";

/** Visible caps so a spoken session stays scannable (browse link shows the rest). */
const CAP_STRONG_GOOD = 12;
const CAP_RELATED = 8;
const CAP_BROAD = 6;
const NO_PREF_LIMIT = 30;
const CANDIDATE_LIMIT = 240;

// ── Pure helpers (unit-tested without a database) ────────────────────────

/** Map the relevance engine's raw score total (≈ −40…105) to a 0–100 badge. */
export function matchPercentOf(total: number): number {
  return Math.min(99, Math.max(5, Math.round((total / 85) * 100)));
}

/** Same URL the AI quick search / wizard produce — for the "see all" link. */
export function buildBrowseUrl(prefs: VoicePreferences, keywords?: string[]): string {
  const params = new URLSearchParams();
  if (prefs.categories?.length) params.set("categories", prefs.categories.join(","));
  if (prefs.interests?.length) params.set("interests", prefs.interests.join(","));
  if (prefs.remote) params.set("remote", "true");
  if (prefs.location) params.set("location", prefs.location);
  if (prefs.experience) params.set("experience", prefs.experience);
  const q = (keywords || []).join(" ").trim();
  if (q) params.set("q", q);
  params.set("sort", "recommended");
  return `/?${params.toString()}`;
}

function toItem(ranked: RankedOpportunity): VoiceResultItem {
  return {
    opportunity: ranked.opportunity,
    matchPercent: matchPercentOf(ranked.score.total),
    matchLevel: ranked.matchLevel as VoiceResultItem["matchLevel"],
    matchLabels: ranked.matchLabels,
  };
}

/**
 * Group ranked results for display: strong+good first, then related, then a
 * capped broader fallback — mirroring the browse page's primary/fallback split.
 */
export function groupRanked(ranked: RankedOpportunity[]): VoiceResultGroup[] {
  const strongGood = ranked.filter(
    (r) => r.matchLevel === "strong" || r.matchLevel === "good"
  );
  const related = ranked.filter((r) => r.matchLevel === "related");
  const broad = ranked.filter((r) => r.matchLevel === "broad");

  const groups: VoiceResultGroup[] = [];
  if (strongGood.length > 0) {
    groups.push({ heading: "Strong matches", items: strongGood.slice(0, CAP_STRONG_GOOD).map(toItem) });
  }
  if (related.length > 0) {
    groups.push({ heading: "Related opportunities", items: related.slice(0, CAP_RELATED).map(toItem) });
  }
  if (broad.length > 0) {
    groups.push({ heading: "Broader picks", items: broad.slice(0, CAP_BROAD).map(toItem) });
  }
  return groups;
}

function clip(text: string | undefined, max: number): string {
  const value = (text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Concise, localized spoken reply. Deterministic templates — en / hi / Hinglish;
 * other language codes fall back to English (the UI itself stays English).
 */
export function buildSpokenSummary(args: {
  total: number;
  strong: number;
  good: number;
  related: number;
  broad?: number;
  top?: { title?: string; organization?: string };
  language?: string;
}): string {
  const { total, strong, good, related, broad = 0, top, language } = args;
  if (total === 0) return getEmptySpokenSummary(language || "en-IN");

  const hasBreakdown = strong + good + related + broad > 0;
  const breakdown = hasBreakdown
    ? [
        strong > 0 ? `${strong} strong` : null,
        good > 0 ? `${good} good` : null,
        related > 0 ? `${related} related` : null,
        broad > 0 ? `${broad} broader` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "closest matches";
  const title = clip(top?.title, 55);
  const org = clip(top?.organization, 30);
  const topLine = title ? ` Top match: ${title}${org ? ` at ${org}` : ""}.` : "";

  const family = String(language || "en-IN").toLowerCase();
  const hinglish = family.startsWith("hi-en");
  const hindi = family.split("-")[0] === "hi";

  if (hindi && !hinglish) {
    const n = total === 1 ? "एक अवसर" : `${total} अवसर`;
    const bd = hasBreakdown ? `${breakdown} मैच मिले` : "करीबी मैच दिखा रहा हूँ";
    return `आपके लिए ${n} मिले। ${bd}।${title ? ` सबसे अच्छा मैच: ${title}${org ? `, ${org}` : ""}।` : ""}`;
  }
  if (hinglish) {
    return `${total} ${total === 1 ? "opportunity" : "opportunities"} mil gaye. ${breakdown} matches.${topLine}`;
  }
  return `Found ${total} ${total === 1 ? "opportunity" : "opportunities"}. ${breakdown} matches.${topLine}`;
}

// ── Database-backed discovery ────────────────────────────────────────────

export interface VoiceDiscoveryInput {
  /** Structured preferences extracted from the transcript. */
  preferences: VoicePreferences;
  /** Leftover keyword terms from the local parser (used as text search). */
  keywords?: string[];
  /** For the spoken/display summary language. */
  language?: string;
}

export interface VoiceDiscoveryOutput {
  groups: VoiceResultGroup[];
  total: number;
  excluded: number;
  browseUrl: string;
  summary: string;
  spokenSummary: string;
  prefs: DiscoveryPreferences;
}

function toDiscoveryPreferences(
  preferences: VoicePreferences,
  keywords: string[]
): DiscoveryPreferences {
  const q = keywords.join(" ").trim();
  return {
    categories: preferences.categories,
    interests: preferences.interests,
    location: preferences.location,
    remote: preferences.remote === true,
    experience: preferences.experience,
    q: q || undefined,
  };
}

/**
 * Run the interpreted preferences through OPPY's two-stage retrieval:
 * broad Mongo candidates → relevance scoring → grouped ranked results.
 *
 * Mirrors app/page.tsx so voice and browse always agree for the same
 * preferences. Retries without keyword over-constraint when the text clause
 * (e.g. a spoken month name) would otherwise yield zero candidates.
 */
export async function discoverVoiceOpportunities(
  input: VoiceDiscoveryInput
): Promise<VoiceDiscoveryOutput> {
  const keywords = (input.keywords || []).map((k) => k.trim()).filter(Boolean);
  const prefs = toDiscoveryPreferences(input.preferences, keywords);
  const hasPreferences = Boolean(
    prefs.categories?.length ||
      prefs.interests?.length ||
      prefs.location ||
      prefs.remote ||
      prefs.experience
  );

  const collection = await getOpportunitiesCollection();
  let ranked: RankedOpportunity[] = [];
  let excluded = 0;

  if (hasPreferences) {
    const run = async (q?: string) => {
      const filter = buildCandidateFilter({ categories: prefs.categories, q });
      const candidates = await collection
        .find(filter)
        .sort(opportunitySort("recommended"))
        .limit(CANDIDATE_LIMIT)
        .toArray();
      const serialized = candidates.map((item) => ({
        ...item,
        _id: item._id.toString(),
      })) as unknown as OpportunityDocument[];
      return {
        ranked: rankOpportunities(serialized, { ...prefs, q }),
        candidateCount: candidates.length,
      };
    };

    let result = await run(prefs.q);
    // Keyword over-constraint (spoken month names, filler terms) → retry broad.
    if (result.ranked.length === 0 && prefs.q) {
      result = await run(undefined);
      prefs.q = undefined;
    }
    ranked = result.ranked;
    excluded = Math.max(0, result.candidateCount - result.ranked.length);
  } else {
    const filter = publicOpportunityFilter({ q: prefs.q, showClosed: false });
    const items = await collection
      .find(filter)
      .sort(opportunitySort("recommended"))
      .limit(NO_PREF_LIMIT)
      .toArray();
    const serialized = items.map((item) => ({
      ...item,
      _id: item._id.toString(),
    })) as unknown as OpportunityDocument[];
    ranked = rankOpportunities(serialized, prefs);
  }

  const groups = groupRanked(ranked);
  // Total = full ranked match count (groups are capped previews), so the
  // spoken breakdown (strong/good/related/broad) always sums to `total`.
  const total = ranked.length;
  const matchSummary = getMatchSummary(ranked, prefs);

  const strong = ranked.filter((r) => r.matchLevel === "strong").length;
  const good = ranked.filter((r) => r.matchLevel === "good").length;
  const related = ranked.filter((r) => r.matchLevel === "related").length;
  const broad = ranked.filter((r) => r.matchLevel === "broad").length;
  const top = ranked[0]?.opportunity;

  return {
    groups,
    total,
    excluded,
    browseUrl: buildBrowseUrl(input.preferences, prefs.q ? keywords : []),
    summary: matchSummary.message,
    spokenSummary: buildSpokenSummary({
      total,
      strong,
      good,
      related,
      broad,
      top: top ? { title: top.title, organization: top.organization } : undefined,
      language: input.language,
    }),
    prefs,
  };
}
