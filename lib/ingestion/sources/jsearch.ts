import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";
import { detectJSearchEndpoint } from "@/lib/ingestion/jsearch-endpoint";
import {
  getJSearchPlanPairsForToday,
  JSearchQueryPair,
} from "@/lib/ingestion/jsearch-plan";
import {
  tryReserveJSearchRequests,
  getJSearchRequestBudget,
  getJSearchRequestsReserved,
} from "@/lib/ingestion/jsearch-budget";
import {
  isEarlyCareerEligibleJob,
  selectApplicationUrl,
} from "@/lib/ingestion/job-quality";

/**
 * JSearch (OpenWeb Ninja) umbrella adapter — queries aggregated job boards
 * (LinkedIn, Indeed, Glassdoor, Naukri, ZipRecruiter, etc.).
 *
 * Required env: JSEARCH_API_KEY (OpenWeb Ninja) — RAPIDAPI_KEY is legacy-only.
 *
 * Strategy notes:
 *   - Small student-focused query plan (14 requests/cycle, India-first with a
 *     rotating international market) instead of the old 88-request grid.
 *   - Hard per-run request budget (JSEARCH_MAX_REQUESTS_PER_RUN) so a run can
 *     never exceed the configured cap / free-tier quota.
 *   - Conservative seniority filter: obvious senior-only roles are dropped.
 *   - Application URLs are never fabricated — only provider-supplied URLs are
 *     used, aggregator-hosted listings pass through verbatim.
 *   - If EVERY request in a run fails, fetch() throws a summary error so the
 *     run is recorded as failed instead of a silent "fetched: 0".
 */

function mapCategory(empType?: string, title?: string): Category {
  const t = (title || "").toLowerCase();
  const e = (empType || "").toLowerCase();
  if (t.includes("intern") || e.includes("intern") || e.includes("part_time")) return "Internship";
  return "Job";
}

function mapJob(job: any, country: string): RawOpportunity | null {
  if (!job.job_title || !job.employer_name) return null;

  // Seniority quality gate — drop obvious senior-only roles.
  const requiredMonths =
    typeof job?.job_required_experience?.required_experience_in_months === "number"
      ? job.job_required_experience.required_experience_in_months
      : undefined;
  if (!isEarlyCareerEligibleJob(job.job_title, requiredMonths)) return null;

  const jobUrl = selectApplicationUrl(job);
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

    const plan: JSearchQueryPair[] = getJSearchPlanPairsForToday();
    const budget = getJSearchRequestBudget();
    console.log(
      `[JSearch] Starting live job discovery (${plan.length} requests planned, budget ${budget})...`
    );

    const seen = new Set<string>();
    const results: RawOpportunity[] = [];
    let filtered = 0;
    let httpFailures = 0;
    let lastStatus: number | null = null;
    let budgetExhausted = false;

    for (const { country, query } of plan) {
      // ── Budget guard: reserve before every request; stop when denied. ──
      if (!tryReserveJSearchRequests(1)) {
        budgetExhausted = true;
        break;
      }

      try {
        const url = new URL(endpoint.url);
        url.searchParams.set("query", query);
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
          httpFailures++;
          lastStatus = res.status;
          console.error(`[JSearch] Query '${query}' (${country}) failed: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const jobs: any[] = data?.data || [];

        for (const job of jobs) {
          if (!job.job_id || seen.has(job.job_id)) continue;
          seen.add(job.job_id);

          const mapped = mapJob(job, country);
          if (mapped) results.push(mapped);
          else filtered++;
        }

        console.log(`[JSearch] '${query}' (${country}): ${jobs.length} raw, ${results.length} total`);

        // Polite delay between requests (respect rate limits)
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        httpFailures++;
        console.error(`[JSearch] Error on '${query}' (${country}):`, err);
      }
    }

    if (budgetExhausted) {
      console.warn(
        `[JSearch] Request budget exhausted (${getJSearchRequestsReserved()}/${budget}) — stopping before exceeding the configured cap.`
      );
    }

    console.log(
      `[JSearch] Total unique jobs fetched: ${results.length} ` +
      `(${getJSearchRequestsReserved()} requests used, ${filtered} filtered out).`
    );

    // If every request failed, surface it as an error so the run is recorded as
    // failed rather than a misleading "fetched: 0" success.
    if (results.length === 0 && httpFailures > 0) {
      throw new Error(
        `[JSearch] All ${httpFailures} requests failed (last HTTP status: ${lastStatus}) — no jobs fetched.`
      );
    }

    return results;
  }
}
