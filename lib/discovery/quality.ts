import { DiscoveryCandidate, QualityResult } from "./contracts";
import { canonicalUrl } from "./normalize";

const ARTICLE_HOSTS = ["dev.to", "news.ycombinator.com", "medium.com"];

/** Generic navigation / homepage / category URLs that are never individual opportunities. */
const HOMEPAGE_PATTERNS = [
  /^https?:\/\/[^/]+\/?$/,                          // bare domain
  /\/(hackathons|internships|jobs|events|programs)\/?$/i,  // category indexes
  /\/(search|explore|discover|browse|all)\/?$/i,     // search/browse pages
  /\/(upcoming|past|open|applied|featured)\/?$/i,    // filter views
];

export function assessCandidate(candidate: DiscoveryCandidate): QualityResult {
  const reasons: string[] = [];
  const url = canonicalUrl(candidate.url);

  // ── Hard rejections ──────────────────────────────────────────────────────
  if (!url) reasons.push("invalid_url");
  if (candidate.title.trim().length < 6) reasons.push("weak_title");
  if (candidate.organization.trim().length < 2) reasons.push("missing_organization");

  // Reject bare homepages / category pages — these are never individual listings
  if (url && HOMEPAGE_PATTERNS.some((p) => p.test(url))) reasons.push("homepage_or_category_page");

  // GitHub issues/PRs are signals, not opportunities
  if (candidate.candidateType === "github_issue" || candidate.candidateType === "github_pr")
    reasons.push("github_issue_requires_program_evidence");

  // Article hosts need editorial follow-up
  if (url && ARTICLE_HOSTS.some((host) => new URL(url).hostname.endsWith(host)))
    reasons.push("article_requires_official_follow_up");

  // Hard reject if fatal quality problems
  if (reasons.includes("invalid_url") || reasons.includes("weak_title") || reasons.includes("missing_organization") || reasons.includes("homepage_or_category_page")) {
    return { publishable: false, state: "rejected", reasons };
  }

  // ── Auto-approve for high-trust, real-opportunity candidates ─────────────
  // Official and platform-tier sources that are actual opportunities (not articles/signals)
  const isAutoPublishable =
    (candidate.trustTier === "official" || candidate.trustTier === "platform") &&
    candidate.candidateType === "opportunity" &&
    !reasons.some((r) => r.includes("article") || r.includes("github"));

  if (isAutoPublishable) {
    return { publishable: true, state: "approved", reasons };
  }

  // Everything else needs human review
  return { publishable: false, state: "needs_review", reasons };
}
