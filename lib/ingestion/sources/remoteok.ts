import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * RemoteOK Source Adapter
 *
 * RemoteOK has a public JSON API at:
 *   https://remoteok.com/api
 *
 * Returns real remote job listings. No auth required.
 */

const API_URL = "https://remoteok.com/api";

function mapCategory(title: string): Category {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "Internship";
  return "Job";
}

function mapJob(job: any): RawOpportunity | null {
  const title = job.position || job.title || "";
  if (!title) return null;

  const company = job.company || job.company_name || "Unknown";
  const companyId = job.id || "";
  const jobUrl = job.url || job.apply_url || job.apply_link || `https://remoteok.com/remote-jobs/${companyId}`;
  const tags = job.tags || job.skills || [];
  const salary = job.salary_min && job.salary_max
    ? `$${(job.salary_min / 1000).toFixed(0)}k–$${(job.salary_max / 1000).toFixed(0)}k`
    : "";

  const description = job.description || job.text || `${title} at ${company}`;
  const image = job.logo || job.company_logo || job.image || null;

  const postedAt = job.date || job.created || job.epoch;
  const postedDate = postedAt ? new Date(postedAt) : null;

  return {
    title: salary ? `${title} (${salary})` : title,
    organization: company,
    category: mapCategory(title),
    location: "Remote",
    tags: [...(Array.isArray(tags) ? tags.slice(0, 5) : []), "remote"].slice(0, 6),
    description: description.substring(0, 2000),
    applicationLink: jobUrl,
    imageUrl: image,
    deadline: null,
    deadlineKind: "rolling",
    source: "RemoteOK",
    sourceUrl: jobUrl,
    sourcePlatform: "Other",
    sourceId: `remoteok-${companyId || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    ...(postedDate && !isNaN(postedDate.getTime()) ? { firstSeenAt: postedDate } : {}),
    isRemote: true,
  } as RawOpportunity & { isRemote: boolean };
}

export class RemoteOKSource implements OpportunitySource {
  name = "RemoteOK";
  platform = "Other" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[RemoteOK] Fetching remote jobs...");

    try {
      const res = await fetch(API_URL, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; OppyBot/1.0)",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        console.warn(`[RemoteOK] Failed: ${res.status}`);
        return [];
      }

      const data = await res.json();

      // RemoteOK returns an array where first item is metadata
      const jobs = Array.isArray(data) ? data.slice(1) : data?.jobs || [];
      const results: RawOpportunity[] = [];
      const seen = new Set<string>();

      for (const job of jobs) {
        // Skip metadata and deleted jobs
        if (!job || job._id === undefined || job.deleted) continue;
        if (job.legal === false) continue; // skip scammy listings

        const key = job.id || job.position;
        if (!key || seen.has(String(key))) continue;
        seen.add(String(key));

        const mapped = mapJob(job);
        if (mapped) results.push(mapped);
      }

      console.log(`[RemoteOK] Total jobs fetched: ${results.length}`);
      return results;
    } catch (err) {
      console.error("[RemoteOK] Error:", err);
      return [];
    }
  }
}
