import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * YCombinator "Work at a Startup" Source Adapter
 *
 * YC's job board is public and exposes an API at:
 *   https://api.ycombinator.com/v0.1/companies
 *
 * Returns real startup jobs from YC-backed companies.
 * No API key required.
 */

const API_URL = "https://api.ycombinator.com/v0.1/companies";

// Query for specific roles
const ROLE_QUERIES = [
  "software engineer",
  "frontend engineer",
  "backend engineer",
  "full stack engineer",
  "machine learning engineer",
  "data scientist",
  "product manager",
  "devops engineer",
  "mobile engineer",
  "founder engineer",
];

function mapCategory(title: string): Category {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "Internship";
  if (t.includes("founder")) return "Job";
  return "Job";
}

function mapJob(job: any, company: any): RawOpportunity | null {
  const title = job.title || job.role || "";
  if (!title) return null;

  const companyName = company.name || company.yc_name || "YC Startup";
  const companyId = company.id || company.slug || "";
  const jobUrl = job.url || `https://www.workatastartup.com/jobs/${companyId}`;
  const location = job.location || company.location || "Remote";
  const isRemote = location.toLowerCase().includes("remote") || company.remote === true;

  const description = job.description || job.text || `${title} at ${companyName}`;

  const salaryMin = job.salary_min || job.min_compensation;
  const salaryMax = job.salary_max || job.max_compensation;
  const salaryStr = salaryMin && salaryMax
    ? ` $${(salaryMin / 1000).toFixed(0)}k–$${(salaryMax / 1000).toFixed(0)}k`
    : "";

  return {
    title: `${title}${salaryStr}`,
    organization: companyName,
    category: mapCategory(title),
    location: isRemote ? "Remote" : location,
    tags: [company.industry || "startup", "yc", "startup"].slice(0, 4),
    description: description.substring(0, 2000),
    applicationLink: jobUrl,
    imageUrl: company.logo_url || company.logo || null,
    deadline: null,
    deadlineKind: "rolling",
    source: "YCombinator",
    sourceUrl: jobUrl,
    sourcePlatform: "YCombinator",
    sourceId: `yc-${companyId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    isRemote,
  } as RawOpportunity & { isRemote: boolean };
}

export class YCStartupsSource implements OpportunitySource {
  name = "YC Work at a Startup";
  platform = "YCombinator" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[YC] Fetching YC startup jobs...");

    const seen = new Set<string>();
    const results: RawOpportunity[] = [];

    for (const role of ROLE_QUERIES) {
      try {
        const url = new URL(API_URL);
        url.searchParams.set("q", role);
        url.searchParams.set("limit", "50");

        const res = await fetch(url.toString(), {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; OppyBot/1.0)",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.warn(`[YC] Query "${role}" failed: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const companies = data?.companies || data || [];

        for (const company of companies) {
          const jobs = company.jobs || company.roles || [];
          for (const job of jobs) {
            const mapped = mapJob(job, company);
            if (!mapped) continue;
            const key = mapped.sourceId || mapped.title;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(mapped);
          }
        }

        console.log(`[YC] "${role}": ${results.length} total so far`);
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`[YC] Error on "${role}":`, err);
      }
    }

    console.log(`[YC] Total jobs fetched: ${results.length}`);
    return results;
  }
}
