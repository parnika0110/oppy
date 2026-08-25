import { RawOpportunity, OpportunitySource } from "@/types/opportunity";

/**
 * Devpost Source Adapter
 *
 * Uses Devpost's internal JSON API (same endpoint the website uses)
 * to get live hackathon listings. Returns structured JSON — no HTML parsing needed.
 */
export class DevpostSource implements OpportunitySource {
  name = "Devpost Hackathons";
  platform = "Devpost" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];

    for (const page of [1, 2, 3]) {
      try {
        const url = `https://devpost.com/hackathons.json?status[]=upcoming&status[]=open&page=${page}`;
        const response = await fetch(url, {
          headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://devpost.com/hackathons",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          console.warn(`[Devpost] Page ${page} returned ${response.status}`);
          break;
        }

        const data = await response.json();
        const hackathons: unknown[] = data?.hackathons ?? [];

        if (hackathons.length === 0) break;

        for (const h of hackathons as Record<string, unknown>[]) {
          const title = String(h.title ?? "").trim();
          if (!title) continue;

          const displayedLocation = h.displayed_location as { location?: unknown } | undefined;

          const applicationLink = String(h.url ?? h.submission_gallery_url ?? "").trim();
          const organization = String(displayedLocation?.location ?? h.organization_name ?? "Devpost").trim();
          const description = String(h.tagline ?? h.description ?? title).substring(0, 2000);
          const location = String(displayedLocation?.location ?? (h.online ? "Online" : "In-Person")).trim() || "Online";

          // Only retain a deadline explicitly supplied by the source.
          let deadline: Date | null = null;
          const endDate = h.submission_period_dates
            ? String(h.submission_period_dates).split("–").pop()?.trim()
            : null;
          if (endDate) {
            const parsed = new Date(endDate);
            if (!isNaN(parsed.getTime())) deadline = parsed;
          }

          const slug = String(h.url ?? "").split("devpost.com/").pop()?.replace(/\/$/, "") ?? title;
          const prize = h.prize_amount ? `Prize: $${h.prize_amount}` : null;

          opportunities.push({
            title,
            organization,
            category: "Hackathon",
            location,
            description: prize ? `${description}\n\n${prize}` : description,
            applicationLink: applicationLink || `https://devpost.com/hackathons`,
            deadline,
            deadlineKind: deadline ? "source_provided" : "unavailable",
            source: "Devpost",
            sourceUrl: applicationLink || `https://devpost.com/hackathons`,
            sourcePlatform: "Devpost",
            sourceId: slug,
            tags: ["hackathon", "devpost"],
          });
        }

        console.log(`[Devpost] Page ${page}: ${hackathons.length} hackathons.`);
      } catch (error) {
        console.error(`[Devpost] Error on page ${page}:`, error);
        break;
      }
    }

    console.log(`[Devpost] Total fetched: ${opportunities.length}`);
    return opportunities;
  }
}
