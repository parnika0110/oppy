import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * Wellfound (formerly AngelList) Source Adapter
 *
 * Uses JSearch (RapidAPI) to find startup jobs from Wellfound/AngelList.
 * Required env: RAPIDAPI_KEY
 */

const BASE_URL = "https://jsearch.p.rapidapi.com/search";

const WELLFOUND_QUERIES = [
  "site:wellfound.com Software Engineer",
  "site:wellfound.com Frontend Developer",
  "site:wellfound.com Backend Developer",
  "site:wellfound.com Full Stack Developer",
  "site:wellfound.com Machine Learning Engineer",
  "site:wellfound.com Data Scientist",
  "site:wellfound.com Product Manager",
  "site:wellfound.com UX Designer",
  "site:wellfound.com DevOps Engineer",
  "site:wellfound.com startup engineer",
];

function mapCategory(title?: string): Category {
  const t = (title || "").toLowerCase();
  if (t.includes("intern")) return "Internship";
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

  // Only include jobs from Wellfound
  const publisher = (job.job_publisher || "").toLowerCase();
  const url = (job.job_url || "").toLowerCase();
  if (!publisher.includes("wellfound") && !publisher.includes("angellist") &&
      !url.includes("wellfound.com") && !url.includes("angel.co")) {
    return null;
  }

  const sourceId: string = job.job_id || "";
  const city: string = job.job_city || "";
  const country: string = job.job_country || "";
  const isRemote: boolean = Boolean(job.job_is_remote);
  const location: string = isRemote
    ? "Remote"
    : [city, country].filter(Boolean).join(", ") || "Unspecified";

  const description: string =
    job.job_description?.substring(0, 2000) || "See the Wellfound listing for full details.";

  const skills: string[] = (job.job_highlights?.Qualifications || [])
    .slice(0, 5)
    .map((q: string) => q.trim())
    .filter(Boolean);

  const category = mapCategory(job.job_title);
  const tags: string[] = Array.from(
    new Set([category, "startup", ...skills.slice(0, 3)])
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
    source: "Wellfound",
    sourceUrl: jobUrl,
    sourcePlatform: "Other",
    sourceId,
    ...(postedAt ? { firstSeenAt: postedAt } : {}),
    isRemote,
  } as RawOpportunity & { isRemote: boolean };
}

export class WellfoundSource implements OpportunitySource {
  name = "Wellfound (AngelList)";
  platform = "Other" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;

    if (!apiKey) {
      console.warn("[Wellfound] RAPIDAPI_KEY not configured — skipping.");
      return [];
    }

    console.log("[Wellfound] Starting Wellfound/AngelList job discovery...");

    const seen = new Set<string>();
    const results: RawOpportunity[] = [];

    for (const q of WELLFOUND_QUERIES) {
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
          console.error(`[Wellfound] Query failed: ${res.status}`);
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

        console.log(`[Wellfound] "${q.substring(0, 50)}": ${jobs.length} raw, ${results.length} total`);
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.error(`[Wellfound] Error:`, err);
      }
    }

    console.log(`[Wellfound] Total unique jobs: ${results.length}`);
    return results;
  }
}
