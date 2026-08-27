import * as cheerio from "cheerio";
import { RawOpportunity, OpportunitySource } from "@/types/opportunity";
import { resolveImageUrl } from "@/lib/images";

/**
 * Naukri Source Adapter
 *
 * Scrapes Naukri.com for jobs and internships.
 * Naukri has public job listing pages that can be scraped
 * without authentication.
 */

const SEARCH_PAGES = [
  "https://www.naukri.com/software-engineering-jobs?experience=0-2",
  "https://www.naukri.com/data-science-jobs?experience=0-2",
  "https://www.naukri.com/web-development-jobs?experience=0-2",
  "https://www.naukri.com/machine-learning-jobs?experience=0-2",
  "https://www.naukri.com/internship-jobs",
  "https://www.naukri.com/fresher-jobs",
];

function mapCategory(title: string): "Internship" | "Job" {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "Internship";
  return "Job";
}

function parseJob(card: any, $: cheerio.CheerioAPI): RawOpportunity | null {
  const $el = $(card);
  const title = $el.find(".title, .ellipsis, [class*='title'], h2, h3").first().text().trim();
  if (!title || title.length < 3) return null;

  const company = $el.find(".companyName, .company, [class*='company']").first().text().trim() || "Unknown";
  const experience = $el.find(".experience, [class*='experience']").first().text().trim();
  const location = $el.find(".location, [class*='location']").first().text().trim() || "India";
  const salary = $el.find(".salary, [class*='salary'], [class*='stipend']").first().text().trim();
  const link = $el.find("a[href*='naukri.com/jobsearch'], a[href*='naukri.com/jobs'], a").first().attr("href") || "";
  const fullLink = link.startsWith("http") ? link : `https://www.naukri.com${link}`;

  const image = $el.find("img").first().attr("src") || null;
  const imageUrl = resolveImageUrl(image, "https://www.naukri.com") || undefined;

  const description = [
    company,
    experience && `Exp: ${experience}`,
    salary && `Salary: ${salary}`,
  ].filter(Boolean).join(" · ");

  const slug = link.split("/").filter(Boolean).pop() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    title,
    organization: company,
    category: mapCategory(title),
    location,
    tags: ["naukri", "india", mapCategory(title).toLowerCase()],
    description: description.substring(0, 2000),
    applicationLink: fullLink,
    imageUrl,
    deadline: null,
    deadlineKind: "rolling",
    source: "Naukri",
    sourceUrl: fullLink,
    sourcePlatform: "Naukri",
    sourceId: `naukri-${slug}`,
  } as RawOpportunity;
}

export class NaukriSource implements OpportunitySource {
  name = "Naukri";
  platform = "Naukri" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[Naukri] Starting Naukri job discovery...");

    const results: RawOpportunity[] = [];
    const seen = new Set<string>();

    for (const pageUrl of SEARCH_PAGES) {
      try {
        const res = await fetch(pageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: AbortSignal.timeout(12000),
        });

        if (!res.ok) {
          console.warn(`[Naukri] ${pageUrl} returned ${res.status}`);
          continue;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        // Try __NEXT_DATA__ first (Naukri uses Next.js)
        const nextData = $("script#__NEXT_DATA__").html();
        if (nextData) {
          try {
            const data = JSON.parse(nextData);
            const jobs = data?.props?.pageProps?.jobSearchResults || data?.props?.pageProps?.jobs || [];
            for (const job of jobs) {
              const mapped = parseJob(job, $);
              if (!mapped) continue;
              const key = mapped.sourceId || mapped.title;
              if (seen.has(key)) continue;
              seen.add(key);
              results.push(mapped);
            }
          } catch { /* JSON parse failed */ }
        }

        // Fallback: scrape HTML cards
        $(".srp-card, .jobTuple, [class*='job-card'], [class*='jobCard'], article").each((_, el) => {
          const mapped = parseJob(el, $);
          if (!mapped) return;
          const key = mapped.sourceId || mapped.title;
          if (seen.has(key)) return;
          seen.add(key);
          results.push(mapped);
        });

        console.log(`[Naukri] ${pageUrl.split("?")[0].split("/").filter(Boolean).pop()}: ${results.length} total so far`);
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`[Naukri] Error on ${pageUrl}:`, err);
      }
    }

    console.log(`[Naukri] Total jobs fetched: ${results.length}`);
    return results;
  }
}
