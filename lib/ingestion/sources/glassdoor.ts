import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * Glassdoor Jobs Source Adapter
 *
 * Uses JSearch (RapidAPI) with Glassdoor-specific queries.
 * Required env: RAPIDAPI_KEY
 */

const BASE_URL = "https://jsearch.p.rapidapi.com/search";

const GLASSDOOR_QUERIES = [
  "site:glassdoor.com Software Engineer intern",
  "site:glassdoor.com Software Developer",
  "site:glassdoor.com Data Scientist",
  "site:glassdoor.com Machine Learning",
  "site:glassdoor.com Frontend Developer",
  "site:glassdoor.com Backend Developer",
  "site:glassdoor.com Full Stack Developer",
  "site:glassdoor.com DevOps Engineer",
  "site:glassdoor.com Product Manager",
  "site:glassdoor.com UX Designer",
  "site:glassdoor.com Cloud Engineer",
  "site:glassdoor.com Junior Developer",
  "site:glassdoor.com Graduate Program",
];

function mapCategory(title?: string, empType?: string): Category {
  const t = (title || "").toLowerCase();
  const e = (empType || "").toLowerCase();
  if (t.includes("intern") || e.includes("intern") || e.includes("part_time")) return "Internship";
  return "Job";
}

function mapJob(job: any): RawOpportunity | null {
  if (!job.job_title || !job.employer_name) return null;

  const jobUrl: string =
    job.job_apply_link ||
    job.job_google_link ||
    job.job_url ||
    "";

  if (!jobUrl) return null;

  // Only include jobs from Glassdoor
  const publisher = (job.job_publisher || "").toLowerCase();
  const url = (job.job_url || "").toLowerCase();
  if (!publisher.includes("glassdoor") && !url.includes("glassdoor.com")) return null;

  const sourceId: string = job.job_id || "";
  const city: string = job.job_city || "";
  const country: string = job.job_country || "";
  const isRemote: boolean = Boolean(job.job_is_remote);
  const location: string = isRemote
    ? "Remote"
    : [city, country].filter(Boolean).join(", ") || "Unspecified";

  const description: string =
    job.job_description?.substring(0, 2000) || "See the Glassdoor listing for full details.";

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
    source: "Glassdoor",
    sourceUrl: jobUrl,
    sourcePlatform: "Glassdoor",
    sourceId,
    ...(postedAt ? { firstSeenAt: postedAt } : {}),
    isRemote,
  } as RawOpportunity & { isRemote: boolean };
}

export class GlassdoorSource implements OpportunitySource {
  name = "Glassdoor Jobs";
  platform = "Glassdoor" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;

    if (!apiKey) {
      console.warn("[Glassdoor] RAPIDAPI_KEY not configured — skipping.");
      return [];
    }

    console.log("[Glassdoor] Starting Glassdoor job discovery...");

    const seen = new Set<string>();
    const results: RawOpportunity[] = [];

    for (const q of GLASSDOOR_QUERIES) {
      try {
        const url = new URL(BASE_URL);
        url.searchParams.set("query", q);
        url.searchParams.set("num_pages", "1");
        url.searchParams.set("page", "1");
        url.searchParams.set("date_posted", "month");
        url.searchParams.set("country", "us");
        url.searchParams.set("language", "en");

        const res = await fetch(url.toString(), {
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
          next: { revalidate: 0 },
        });

        if (!res.ok) {
          console.error(`[Glassdoor] Query failed: ${res.status}`);
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

        console.log(`[Glassdoor] "${q.substring(0, 50)}": ${jobs.length} raw, ${results.length} total`);
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.error(`[Glassdoor] Error:`, err);
      }
    }

    console.log(`[Glassdoor] Total unique jobs: ${results.length}`);
    return results;
  }
}
