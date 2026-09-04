import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * LinkedIn Jobs Source Adapter
 *
 * Uses JSearch (OpenWeb Ninja) with LinkedIn-specific queries to discover
 * real job and internship listings from LinkedIn.
 *
 * Required env: JSEARCH_API_KEY (OpenWeb Ninja) — RAPIDAPI_KEY is legacy-only.
 * Shares the JSearch request budget, seniority filter and URL policy.
 */

import { detectJSearchEndpoint } from "@/lib/ingestion/jsearch-endpoint";
import {
  tryReserveJSearchRequests,
  getJSearchRequestsReserved,
} from "@/lib/ingestion/jsearch-budget";
import {
  isEarlyCareerEligibleJob,
  selectApplicationUrl,
} from "@/lib/ingestion/job-quality";

const BASE_URL = "https://jsearch.p.rapidapi.com/search"; // fallback

const LINKEDIN_QUERIES = [
  "site:linkedin.com/jobs Software Engineer intern",
  "site:linkedin.com/jobs Software Developer",
  "site:linkedin.com/jobs Data Scientist",
  "site:linkedin.com/jobs Machine Learning Engineer",
  "site:linkedin.com/jobs Frontend Developer",
  "site:linkedin.com/jobs Backend Developer",
  "site:linkedin.com/jobs Full Stack Developer",
  "site:linkedin.com/jobs Product Manager",
  "site:linkedin.com/jobs UX Designer",
  "site:linkedin.com/jobs DevOps Engineer",
  "site:linkedin.com/jobs Cloud Engineer",
  "site:linkedin.com/jobs Cybersecurity Analyst",
  "site:linkedin.com/jobs Research Intern",
  "site:linkedin.com/jobs Graduate Program",
  "site:linkedin.com/jobs Entry Level",
];

function mapCategory(title?: string, empType?: string): Category {
  const t = (title || "").toLowerCase();
  const e = (empType || "").toLowerCase();
  if (t.includes("intern") || e.includes("intern") || e.includes("part_time")) return "Internship";
  if (t.includes("graduate") || t.includes("entry level") || t.includes("trainee")) return "Job";
  return "Job";
}

function mapJob(job: any): RawOpportunity | null {
  if (!job.job_title || !job.employer_name) return null;

  // Seniority quality gate — drop obvious senior-only roles.
  const requiredMonths =
    typeof job?.job_required_experience?.required_experience_in_months === "number"
      ? job.job_required_experience.required_experience_in_months
      : undefined;
  if (!isEarlyCareerEligibleJob(job.job_title, requiredMonths)) return null;

  const jobUrl = selectApplicationUrl(job);

  if (!jobUrl) return null;

  // Only include jobs actually from LinkedIn
  const publisher = (job.job_publisher || "").toLowerCase();
  const url = (job.job_url || "").toLowerCase();
  if (!publisher.includes("linkedin") && !url.includes("linkedin.com")) return null;

  const sourceId: string = job.job_id || "";
  const city: string = job.job_city || "";
  const country: string = job.job_country || "";
  const isRemote: boolean = Boolean(job.job_is_remote);
  const location: string = isRemote
    ? "Remote"
    : [city, country].filter(Boolean).join(", ") || "Unspecified";

  const description: string =
    job.job_description?.substring(0, 2000) || "See the LinkedIn listing for full details.";

  const skills: string[] = (job.job_highlights?.Qualifications || [])
    .slice(0, 5)
    .map((q: string) => q.trim())
    .filter(Boolean);

  const category = mapCategory(job.job_title, job.job_employment_type);
  const tags: string[] = Array.from(
    new Set([category, ...skills.slice(0, 3)])
  ).slice(0, 6);

  const imageUrl: string | null = job.employer_logo || null;

  const postedAt: Date | null = job.job_posted_at_timestamp
    ? new Date(job.job_posted_at_timestamp * 1000)
    : null;

  return {
    title: job.job_title,
    organization: job.employer_name,
    category,
    location,
    tags,
    description,
    applicationLink: jobUrl,
    imageUrl,
    deadline: null,
    deadlineKind: "unavailable",
    source: "LinkedIn",
    sourceUrl: jobUrl,
    sourcePlatform: "LinkedIn",
    sourceId,
    ...(postedAt ? { firstSeenAt: postedAt } : {}),
    isRemote,
  } as RawOpportunity & { isRemote: boolean };
}

export class LinkedInSource implements OpportunitySource {
  name = "LinkedIn Jobs";
  platform = "LinkedIn" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const endpoint = await detectJSearchEndpoint();
    if (!endpoint) {
      console.warn("[LinkedIn] No working JSearch endpoint — skipping.");
      return [];
    }

    console.log("[LinkedIn] Starting LinkedIn job discovery...");

    // Whole-grid budget reservation: skip cleanly when the shared per-run
    // budget is already consumed (e.g. by the umbrella grid earlier in the
    // same pipeline) instead of running a partial query set.
    if (!tryReserveJSearchRequests(LINKEDIN_QUERIES.length)) {
      console.warn(
        `[LinkedIn] Request budget exhausted (${getJSearchRequestsReserved()}) — skipping this run.`
      );
      return [];
    }

    const seen = new Set<string>();
    const results: RawOpportunity[] = [];

    for (const q of LINKEDIN_QUERIES) {
      try {
        const url = new URL(endpoint.url);
        url.searchParams.set("query", q);
        url.searchParams.set("num_pages", "1");
        url.searchParams.set("page", "1");
        url.searchParams.set("date_posted", "month");
        url.searchParams.set("country", "in");
        url.searchParams.set("language", "en");

        const res = await fetch(url.toString(), {
          headers: endpoint.headers,
          next: { revalidate: 0 },
        });

        if (!res.ok) {
          console.error(`[LinkedIn] Query failed: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const jobs: any[] = data?.data || [];

        for (const job of jobs) {
          if (!job.job_id || seen.has(job.job_id)) continue;
          seen.add(job.job_id);

          const mapped = mapJob(job);
          if (mapped) results.push(mapped);
        }

        console.log(`[LinkedIn] "${q.substring(0, 50)}": ${jobs.length} raw, ${results.length} total`);
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.error(`[LinkedIn] Error:`, err);
      }
    }

    console.log(`[LinkedIn] Total unique jobs: ${results.length}`);
    return results;
  }
}
