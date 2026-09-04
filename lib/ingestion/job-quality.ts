/**
 * Job-quality helpers shared by all JSearch-dependent adapters
 * (JSearch, LinkedIn, Indeed, Glassdoor, Wellfound).
 *
 * 1. Seniority filter — OPPY is student/early-career focused. Obvious
 *    senior-only roles (Sr. Director, Staff/Principal Engineer, Architect,
 *    Head of ..., etc.) are rejected while internships, graduate/new-grad and
 *    entry-level roles are preserved.
 *
 * 2. Apply-URL selection — only ever returns one of the URLs the provider
 *    actually supplied. Aggregator-hosted listings (bebee/shine/jobleads/
 *    learn4good) legitimately only have aggregator URLs; we never invent or
 *    guess a "direct employer" URL, so those pass through verbatim.
 */

const SENIOR_ROLE_MARKERS =
  /\b(senior|sr\.?|snr\.?|staff|principal|distinguished|director|architect|vp|vice[- ]president|head of|lead|manager)\b/i;

// Early-career markers OVERRIDE the senior markers: "Senior Software Engineer
// Intern" and "Lead Product Manager, Graduate Program" are early-career roles.
const EARLY_CAREER_MARKERS =
  /\b(intern|internship|graduate|entry[- ]level|junior|new[- ]grad(?:uate)?|trainee|student|fresher|apprentice|co-?op|early[- ]career)\b/i;

/** True when a title is unambiguously a senior-only role (no early-career signal). */
export function isSeniorOnlyTitle(title: string): boolean {
  if (!title) return false;
  if (!SENIOR_ROLE_MARKERS.test(title)) return false;
  if (EARLY_CAREER_MARKERS.test(title)) return false;
  return true;
}

/**
 * Eligibility gate applied before a raw job becomes an opportunity.
 *
 * - Titles that are clearly senior-only (and carry no early-career signal) are
 *   rejected.
 * - When the provider exposes a numeric required-experience field, roles
 *   demanding more than `maxExperienceMonths` (default 48 = 4 years) are
 *   rejected too. Absent/undefined experience data has no effect — unknown is
 *   treated as eligible so we never aggressively discard real listings.
 */
export function isEarlyCareerEligibleJob(
  title: string,
  requiredExperienceMonths?: number,
  maxExperienceMonths: number = 48
): boolean {
  if (isSeniorOnlyTitle(title)) return false;
  if (
    typeof requiredExperienceMonths === "number" &&
    Number.isFinite(requiredExperienceMonths) &&
    requiredExperienceMonths > maxExperienceMonths
  ) {
    return false;
  }
  return true;
}

/**
 * Select the best application URL strictly from the provider-supplied fields.
 *
 * Order: job_apply_link → job_google_link → job_url. Only http(s) URLs are
 * accepted; malformed or empty values are skipped. Returns "" when nothing
 * usable exists — the caller must then drop the job rather than fabricate a
 * destination. `employer_website`/logos are deliberately never used as apply
 * links.
 */
export function selectApplicationUrl(job: any): string {
  const candidates = [
    job?.job_apply_link,
    job?.job_google_link,
    job?.job_url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate.trim())) {
      return candidate.trim();
    }
  }
  return "";
}
