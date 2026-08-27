/**
 * URL quality utilities for determining the best apply/link URL.
 *
 * Some opportunities have `applicationLink` pointing to a platform homepage
 * (e.g. https://lu.ma/explore, https://mlh.io/) rather than the specific
 * opportunity page. This module detects and filters those out.
 */

/** Known platform homepage patterns — these should never be "Apply" links. */
const PLATFORM_HOMEPAGES: RegExp[] = [
  /^https?:\/\/lu\.ma\/?$/i,
  /^https?:\/\/lu\.ma\/explore/i,
  /^https?:\/\/lu\.ma\/calendar/i,
  /^https?:\/\/mlh\.io\/?$/i,
  /^https?:\/\/devpost\.com\/?$/i,
  /^https?:\/\/devfolio\.co\/?$/i,
  /^https?:\/\/github\.com\/?$/i,
  /^https?:\/\/internshala\.com\/?$/i,
  /^https?:\/\/naukri\.com\/?$/i,
  /^https?:\/\/linkedin\.com\/?$/i,
  /^https?:\/\/www\.linkedin\.com\/?$/i,
  /^https?:\/\/indeed\.com\/?$/i,
  /^https?:\/\/google\.com\/?$/i,
  /^https?:\/\/www\.google\.com\/?$/i,
  /^https?:\/\/careers\.google\.com\/?$/i,
  /^https?:\/\/microsoft\.com\/?$/i,
  /^https?:\/\/www\.microsoft\.com\/?$/i,
];

/**
 * Returns true if the URL is clearly a platform homepage
 * rather than a specific opportunity page.
 */
export function isPlatformHomepage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    // Check pathname is very short (just / or /explore etc.)
    const path = u.pathname.replace(/\/+$/, "");
    if (path === "" || path === "/explore" || path === "/calendar" || path === "/events") {
      return PLATFORM_HOMEPAGES.some((re) => re.test(url));
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Determine the best CTA URL for an opportunity.
 *
 * Priority:
 * 1. applicationUrl — the specific application/registration form
 * 2. eventUrl — the specific event page
 * 3. sourceUrl — the specific listing page (if not a platform homepage)
 * 4. applicationLink — the application link (if not a platform homepage)
 * 5. officialSourceUrl — the official source page
 *
 * Returns null if no suitable URL is found.
 */
export function getBestCtaUrl(opp: {
  applicationUrl?: string | null;
  eventUrl?: string | null;
  sourceUrl?: string | null;
  applicationLink?: string | null;
  officialSourceUrl?: string | null;
}): string | null {
  // 1. Explicit application URL (best)
  if (opp.applicationUrl && opp.applicationUrl.startsWith("http")) {
    return opp.applicationUrl;
  }

  // 2. Event URL (for events/hackathons)
  if (opp.eventUrl && opp.eventUrl.startsWith("http")) {
    return opp.eventUrl;
  }

  // 3. Source URL — but only if it's not a platform homepage
  if (
    opp.sourceUrl &&
    opp.sourceUrl.startsWith("http") &&
    !isPlatformHomepage(opp.sourceUrl)
  ) {
    return opp.sourceUrl;
  }

  // 4. Application link — but only if not a platform homepage
  if (
    opp.applicationLink &&
    opp.applicationLink.startsWith("http") &&
    !isPlatformHomepage(opp.applicationLink)
  ) {
    return opp.applicationLink;
  }

  // 5. Official source URL
  if (
    opp.officialSourceUrl &&
    opp.officialSourceUrl.startsWith("http") &&
    !isPlatformHomepage(opp.officialSourceUrl)
  ) {
    return opp.officialSourceUrl;
  }

  // 6. Fallback: use sourceUrl or applicationLink even if it's a platform homepage
  // (better to have some link than none)
  if (opp.sourceUrl && opp.sourceUrl.startsWith("http")) {
    return opp.sourceUrl;
  }
  if (opp.applicationLink && opp.applicationLink.startsWith("http")) {
    return opp.applicationLink;
  }

  return null;
}

/**
 * Get a human-readable label for the CTA URL destination.
 */
export function getCtaLabel(url: string | null): string {
  if (!url) return "View details →";
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    if (hostname.includes("devpost")) return "View on Devpost →";
    if (hostname.includes("devfolio")) return "View on Devfolio →";
    if (hostname.includes("github.com")) return "View on GitHub →";
    if (hostname.includes("lu.ma")) return "View on Luma →";
    if (hostname.includes("mlh.io")) return "View on MLH →";
    if (hostname.includes("internshala")) return "View on Internshala →";
    if (hostname.includes("outreachy")) return "Apply on Outreachy →";
    if (hostname.includes("summerofcode")) return "Apply on GSoC →";
    if (hostname.includes("imaginecup")) return "View on Imagine Cup →";
    if (hostname.includes("education.github")) return "View on GitHub Education →";
    if (hostname.includes("startupschool")) return "View on YC Startup School →";
  } catch {
    // ignore
  }
  return "Visit source →";
}
