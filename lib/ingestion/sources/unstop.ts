import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * Unstop (formerly Dare2Compete) Source Adapter
 *
 * Unstop is a major Indian platform for competitions, hackathons,
 * internships, and campus hiring. They have a public API.
 *
 * No auth required for public listings.
 */

const API_URL = "https://api.unstop.com/api/opportunities";

function mapCategory(type: string): Category {
  const t = type.toLowerCase();
  if (t.includes("hackathon") || t.includes("coding contest") || t.includes("hack")) return "Hackathon";
  if (t.includes("intern")) return "Internship";
  if (t.includes("scholarship") || t.includes("fellowship")) return "Scholarship";
  if (t.includes("competition") || t.includes("contest") || t.includes("challenge")) return "Hackathon";
  if (t.includes("event") || t.includes("workshop") || t.includes("webinar")) return "Event";
  return "Event";
}

function mapJob(item: any): RawOpportunity | null {
  const title = item.title || item.name || "";
  if (!title) return null;

  const type = item.type || item.opportunity_type || item.category || "competition";
  const orgName = item.organization?.name || item.company_name || item.organization_name || "Unstop";
  const slug = item.slug || item.id || "";
  const url = item.url || item.opportunity_url || (slug ? `https://unstop.com/opportunity/${slug}` : "");
  const deadline = item.application_deadline || item.deadline || item.end_date || null;
  const image = item.banner?.url || item.image?.url || item.banner_url || item.image_url || null;
  const location = item.location || item.city || "Online";
  const isRemote = location.toLowerCase().includes("online") || location.toLowerCase().includes("remote");

  const description = (item.description || item.short_description || title).substring(0, 2000);

  const deadlineDate = deadline ? new Date(deadline) : null;
  const validDeadline = deadlineDate && !isNaN(deadlineDate.getTime()) ? deadlineDate : null;

  // Check if already expired
  if (validDeadline && validDeadline.getTime() < Date.now() - 7 * 24 * 3600 * 1000) {
    return null; // Skip opportunities expired more than 7 days ago
  }

  return {
    title,
    organization: orgName,
    category: mapCategory(type),
    location: isRemote ? "Online" : location,
    tags: [type.toLowerCase(), "unstop", "india"].slice(0, 4),
    description,
    applicationLink: url,
    imageUrl: image,
    deadline: validDeadline,
    deadlineKind: validDeadline ? "source_provided" : "unavailable",
    source: "Unstop",
    sourceUrl: url,
    sourcePlatform: "Other",
    sourceId: `unstop-${slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  } as RawOpportunity;
}

export class UnstopSource implements OpportunitySource {
  name = "Unstop (D2C)";
  platform = "Other" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[Unstop] Fetching competitions and opportunities...");

    const results: RawOpportunity[] = [];
    const seen = new Set<string>();

    // Unstop has multiple category pages
    const categories = [
      "hackathons",
      "internships",
      "competitions",
      "scholarships",
      "workshops",
    ];

    for (const cat of categories) {
      try {
        const url = new URL(API_URL);
        url.searchParams.set("type", cat);
        url.searchParams.set("status", "active");
        url.searchParams.set("page", "1");
        url.searchParams.set("limit", "50");

        const res = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; OppyBot/1.0)",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.warn(`[Unstop] Category "${cat}" failed: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const items = data?.data || data?.results || data?.opportunities || data || [];

        for (const item of items) {
          const mapped = mapJob(item);
          if (!mapped) continue;
          const key = mapped.sourceId || mapped.title;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push(mapped);
        }

        console.log(`[Unstop] "${cat}": ${results.length} total so far`);
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.error(`[Unstop] Error on "${cat}":`, err);
      }
    }

    // Fallback: try scraping the main opportunity page if API didn't work
    if (results.length === 0) {
      try {
        console.log("[Unstop] API returned nothing, trying HTML scrape...");
        const scrapeRes = await fetch("https://unstop.com/opportunities", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/html",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (scrapeRes.ok) {
          const html = await scrapeRes.text();
          // Try to find __NEXT_DATA__ or similar embedded JSON
          const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
          if (nextDataMatch) {
            try {
              const nextData = JSON.parse(nextDataMatch[1]);
              const opportunities = nextData?.props?.pageProps?.opportunities || [];
              for (const item of opportunities) {
                const mapped = mapJob(item);
                if (!mapped) continue;
                const key = mapped.sourceId || mapped.title;
                if (seen.has(key)) continue;
                seen.add(key);
                results.push(mapped);
              }
            } catch { /* JSON parse failed */ }
          }
        }
      } catch (err) {
        console.error("[Unstop] Scrape fallback failed:", err);
      }
    }

    console.log(`[Unstop] Total fetched: ${results.length}`);
    return results;
  }
}
