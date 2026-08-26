import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * JSearch (RapidAPI) adapter — queries aggregated job boards
 * (LinkedIn, Indeed, Glassdoor, Naukri, ZipRecruiter, etc.)
 *
 * Required env: RAPIDAPI_KEY  (or JSEARCH_API_KEY as alias)
 * If neither is set, the source logs a clear "Not configured" message
 * and returns zero results — no fake data is ever emitted.
 */

const BASE_URL = "https://jsearch.p.rapidapi.com/search";

// Intern-oriented queries covering AI/ML/CS/Frontend/Backend/Research
const SEARCH_QUERIES = [
  "Software Engineering Intern",
  "Software Developer Intern",
  "Machine Learning Intern",
  "Data Science Intern",
  "AI Intern",
  "Frontend Engineering Intern",
  "Backend Engineering Intern",
  "Full Stack Intern",
  "Research Intern Computer Science",
  "Student Developer",
  "Graduate Software Engineer",
];

// Normalise JSearch employment_type to our Category taxonomy.
// "Job" is a first-class Category (see types/opportunity.ts) — not a cast-to-fit hack.
function mapCategory(empType?: string, title?: string): Category {
  const t = (title || "").toLowerCase();
  const e = (empType || "").toLowerCase();
  if (t.includes("intern") || e.includes("intern") || e.includes("part_time")) return "Internship";
  return "Job";
}

// Map raw JSearch job to our RawOpportunity shape
function mapJob(job: any): RawOpportunity | null {
  // Skip records with no real job title or company
  if (!job.job_title || !job.employer_name) return null;

  // Build the best possible direct URL
  const jobUrl: string =
    job.job_apply_link ||
    job.job_google_link ||
    job.job_url ||
    "";

  if (!jobUrl) return null;

  // Build a clean sourceId from the JSearch job_id
  const sourceId: string = job.job_id || "";

  // Location
  const city: string = job.job_city || "";
  const country: string = job.job_country || "";
  const isRemote: boolean = Boolean(job.job_is_remote);
  const location: string = isRemote
    ? "Remote"
    : [city, country].filter(Boolean).join(", ") || "Unspecified";

  // Description — JSearch provides full text
  const description: string =
    job.job_description?.substring(0, 2000) || "See the official listing for full details.";

  // Skills / highlights
  const skills: string[] = (job.job_highlights?.Qualifications || [])
    .slice(0, 5)
    .map((q: string) => q.trim())
    .filter(Boolean);

  // Tags derived from skills + category
  const category = mapCategory(job.job_employment_type, job.job_title);
  const tags: string[] = Array.from(
    new Set([category, ...skills.slice(0, 3)])
  ).slice(0, 6);

  // Deadline — only store if the listing explicitly mentions one
  // JSearch does not reliably expose application deadlines.
  // We do not infer from posting date.
  const deadline: string | null = null;

  // Image — use employer_logo if present, never fake one
  const imageUrl: string | null = job.employer_logo || null;

  // Platform — prefer the direct platform name from JSearch
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

  // Posted date (for discoveredAt ordering — real value from source)
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
    sourcePlatform,
    sourceId,
    // Extended fields (cast to any to pass through ingestion index)
    ...(postedAt ? { firstSeenAt: postedAt } : {}),
    isRemote,
  } as RawOpportunity & { isRemote: boolean };
}

export class JSearchSource implements OpportunitySource {
  name = "JSearch (LinkedIn/Indeed/Glassdoor)";
  platform = "JSearch" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;

    if (!apiKey) {
      console.warn("[JSearch] RAPIDAPI_KEY not configured — skipping. Set RAPIDAPI_KEY in .env.local to enable live job discovery.");
      return [];
    }

    console.log("[JSearch] Starting live job discovery…");

    const seen = new Set<string>(); // dedup by sourceId across queries
    const results: RawOpportunity[] = [];

    // Run a subset of queries (limit API calls in dev; rotate in prod)
    // Process up to 3 queries × 10 results = 30 raw results per run
    const activeQueries = SEARCH_QUERIES.slice(0, 3);

    for (const q of activeQueries) {
      try {
        const url = new URL(BASE_URL);
        url.searchParams.set("query", q);
        url.searchParams.set("num_pages", "1");
        url.searchParams.set("page", "1");
        url.searchParams.set("date_posted", "month"); // last 30 days
        // Prefer India-based / remote roles
        url.searchParams.set("country", "IN");
        url.searchParams.set("language", "en");

        const res = await fetch(url.toString(), {
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
          next: { revalidate: 0 }, // always fresh
        });

        if (!res.ok) {
          console.error(`[JSearch] Query "${q}" failed: ${res.status} ${res.statusText}`);
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

        console.log(`[JSearch] Query "${q}": ${jobs.length} raw, ${results.length} total so far`);

        // Polite delay between requests
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.error(`[JSearch] Query "${q}" error:`, err);
      }
    }

    console.log(`[JSearch] Total unique jobs fetched: ${results.length}`);
    return results;
  }
}
