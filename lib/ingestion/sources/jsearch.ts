import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";
import { detectJSearchEndpoint } from "@/lib/ingestion/jsearch-endpoint";

/**
 * JSearch (RapidAPI) adapter — queries aggregated job boards
 * (LinkedIn, Indeed, Glassdoor, Naukri, ZipRecruiter, etc.)
 *
 * Required env: RAPIDAPI_KEY  (or JSEARCH_API_KEY as alias)
 * If neither is set, the source logs a clear "Not configured" message
 * and returns zero results — no fake data is ever emitted.
 */

// JSearch API migrated from RapidAPI to OpenWeb Ninja.
// Try the new endpoint first, fall back to legacy.
const BASE_URLS = [
  "https://api.openwebninja.com/jsearch/search",
  "https://jsearch.p.rapidapi.com/search",
];

// Comprehensive queries covering all major job categories
const SEARCH_QUERIES = [
  // Software Engineering
  "Software Engineering Intern",
  "Software Developer Intern",
  "Full Stack Developer Intern",
  "Backend Engineering Intern",
  "Frontend Engineering Intern",
  // AI/ML
  "Machine Learning Intern",
  "Data Science Intern",
  "AI Research Intern",
  // General
  "Student Developer Program",
  "Graduate Software Engineer",
  "Entry Level Software Engineer",
];

// Country rotation — covers major job markets + France + Singapore
const COUNTRIES = ["IN", "US", "GB", "DE", "CA", "AU", "FR", "SG"];

function mapCategory(empType?: string, title?: string): Category {
  const t = (title || "").toLowerCase();
  const e = (empType || "").toLowerCase();
  if (t.includes("intern") || e.includes("intern") || e.includes("part_time")) return "Internship";
  return "Job";
}

function mapJob(job: any, country: string): RawOpportunity | null {
  if (!job.job_title || !job.employer_name) return null;

  const jobUrl: string =
    job.job_apply_link ||
    job.job_google_link ||
    job.job_url ||
    "";

  if (!jobUrl) return null;

  const sourceId: string = job.job_id || "";
  const city: string = job.job_city || "";
  const jobCountry: string = job.job_country || country;
  const isRemote: boolean = Boolean(job.job_is_remote);
  const location: string = isRemote
    ? "Remote"
    : [city, jobCountry].filter(Boolean).join(", ") || "Unspecified";

  const description: string =
    job.job_description?.substring(0, 2000) || "See the official listing for full details.";

  const skills: string[] = (job.job_highlights?.Qualifications || [])
    .slice(0, 5)
    .map((q: string) => q.trim())
    .filter(Boolean);

  const category = mapCategory(job.job_employment_type, job.job_title);
  const tags: string[] = Array.from(
    new Set([category, ...skills.slice(0, 3)])
  ).slice(0, 6);

  // JSearch does not reliably expose application deadlines
  const deadline: string | null = null;
  const imageUrl: string | null = job.employer_logo || null;

  const platformMap: Record<string, string> = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    glassdoor: "Glassdoor",
    naukri: "Naukri",
    ziprecruiter: "ZipRecruiter",
    monster: "Monster",
    dice: "Dice",
  };
  const viaRaw: string = (job.job_publisher || "").toLowerCase();
  let sourcePlatform = "JSearch";
  for (const [key, label] of Object.entries(platformMap)) {
    if (viaRaw.includes(key)) { sourcePlatform = label; break; }
  }

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
    deadline,
    deadlineKind: "unavailable",
    source: sourcePlatform,
    sourceUrl: jobUrl,
    sourcePlatform: sourcePlatform as any,
    sourceId,
    ...(postedAt ? { firstSeenAt: postedAt } : {}),
    isRemote,
  } as RawOpportunity & { isRemote: boolean };
}

export class JSearchSource implements OpportunitySource {
  name = "JSearch (LinkedIn/Indeed/Glassdoor/Naukri)";
  platform = "JSearch" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const endpoint = await detectJSearchEndpoint();
    if (!endpoint) {
      console.warn("[JSearch] No working JSearch endpoint — skipping.");
      return [];
    }

    console.log(`[JSearch] Starting live job discovery across ${COUNTRIES.length} markets...`);

    const seen = new Set<string>();
    const results: RawOpportunity[] = [];

    // Run ALL queries across ALL countries — each query × each country
    for (const country of COUNTRIES) {
      for (const q of SEARCH_QUERIES) {
        try {
          const url = new URL(endpoint.url);
          url.searchParams.set("query", q);
          url.searchParams.set("num_pages", "1");
          url.searchParams.set("page", "1");
          url.searchParams.set("date_posted", "month");
          url.searchParams.set("country", country);
          url.searchParams.set("language", "en");

          const res = await fetch(url.toString(), {
            headers: endpoint.headers,
            next: { revalidate: 0 },
          });

          if (!res.ok) {
            console.error(`[JSearch] Query '${q}' (${country}) failed: ${res.status}`);
            continue;
          }

          const data = await res.json();
          const jobs: any[] = data?.data || [];

          for (const job of jobs) {
            if (!job.job_id || seen.has(job.job_id)) continue;
            seen.add(job.job_id);

            const mapped = mapJob(job, country);
            if (mapped) results.push(mapped);
          }

          console.log(`[JSearch] '${q}' (${country}): ${jobs.length} raw, ${results.length} total`);

          // Polite delay between requests (respect rate limits)
          await new Promise((r) => setTimeout(r, 250));
        } catch (err) {
          console.error(`[JSearch] Error on '${q}' (${country}):`, err);
        }
      }
    }

    console.log(`[JSearch] Total unique jobs fetched: ${results.length}`);
    return results;
  }
}
