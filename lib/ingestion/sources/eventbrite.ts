import * as cheerio from "cheerio";
import { RawOpportunity, OpportunitySource } from "@/types/opportunity";

/**
 * Eventbrite Source Adapter
 *
 * Eventbrite has public event pages that can be scraped.
 * Uses their public search pages for tech/startup events.
 */

const SEARCH_PAGES = [
  // Online events
  "https://www.eventbrite.com/d/online/tech-events/",
  "https://www.eventbrite.com/d/online/hackathon/",
  "https://www.eventbrite.com/d/online/career-development/",
  // Physical / in-person events — major tech hubs
  "https://www.eventbrite.com/d/india--bangalore/tech-events/",
  "https://www.eventbrite.com/d/india--mumbai/tech-events/",
  "https://www.eventbrite.com/d/united-states--san-francisco/tech-events/",
  "https://www.eventbrite.com/d/united-states--new-york/tech-events/",
  // NOTE: /workshop/ and /startup/ are excluded because they return
  // non-tech events (mental health workshops, drawing classes, budget
  // workshops, business networking circles) that are not relevant
  // opportunities for our users.
];

function isRealEventUrl(url: string): boolean {
  // Eventbrite individual events have /e/ in the path
  // e.g. /e/some-event-name-123456789
  // Reject: /d/ (search), /c/ (category), /b/ (browse), homepages
  try {
    const u = new URL(url);
    const path = u.pathname;
    return path.includes("/e/") && !path.endsWith("/e/");
  } catch {
    return false;
  }
}

/**
 * Extract dates from JSON-LD structured data embedded in event pages.
 * Eventbrite often includes schema.org Event markup with startDate/endDate.
 */
function extractDatesFromJsonLd(html: string): { eventDate: Date | null; eventEndDate: Date | null } {
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!jsonLdBlocks) return { eventDate: null, eventEndDate: null };

  for (const block of jsonLdBlocks) {
    try {
      const jsonStr = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
      const data = JSON.parse(jsonStr);

      // schema.org Event has startDate/endDate
      if (data["@type"] === "Event" || data["@type"] === "BusinessEvent") {
        const startDate = data.startDate ? new Date(data.startDate) : null;
        const endDate = data.endDate ? new Date(data.endDate) : null;
        return {
          eventDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
          eventEndDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
        };
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  return { eventDate: null, eventEndDate: null };
}

function parseEvent(card: any, $: cheerio.CheerioAPI, html?: string): RawOpportunity | null {
  const $el = $(card);
  const title = $el.find("h2, h3, [class*='title'], [data-testid='card-title']").first().text().trim();
  if (!title || title.length < 3) return null;

  const link = $el.find("a[href*='eventbrite.com']").first().attr("href") ||
    $el.find("a").first().attr("href") || "";
  const fullLink = link.startsWith("http") ? link : `https://www.eventbrite.com${link}`;

  // Reject numbered search results, category pages, non-event URLs
  if (!isRealEventUrl(fullLink)) return null;
  if (/^\d+\.\s/i.test(title)) return null;
  if (title.length < 5) return null;

  // ── Date extraction: JSON-LD first, then HTML selectors ──
  let eventDate: Date | null = null;
  let eventEndDate: Date | null = null;

  // Try JSON-LD structured data
  if (html) {
    const dates = extractDatesFromJsonLd(html);
    eventDate = dates.eventDate;
    eventEndDate = dates.eventEndDate;
  }

  // Fallback: HTML date selectors
  if (!eventDate) {
    const dateText = $el.find("[class*='date'], time, [data-testid='date']").first().text().trim() ||
      $el.find("[class*='semester']").first().text().trim();
    if (dateText) {
      const parsed = new Date(dateText);
      if (!isNaN(parsed.getTime())) eventDate = parsed;
    }
  }

  const location = $el.find("[class*='location'], [data-testid='location']").first().text().trim() ||
    "Online";

  const image = $el.find("img").first().attr("src") ||
    $el.find("[style*='background-image']").first().attr("style")?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] ||
    null;

  const org = $el.find("[class*='organizer'], [class*='host'], [data-testid='organizer']").first().text().trim() ||
    "Eventbrite";

  return {
    title,
    organization: org,
    category: "Event",
    location: location || "Online",
    tags: ["events", "tech", "eventbrite"],
    description: `${title} — hosted on Eventbrite`,
    applicationLink: fullLink,
    imageUrl: image,
    deadline: null,
    deadlineKind: "unavailable",
    source: "Eventbrite",
    sourceUrl: fullLink,
    sourcePlatform: "Eventbrite",
    sourceId: `eventbrite-${fullLink.split("/").filter(Boolean).pop() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    eventDate: eventDate || undefined,
    eventEndDate: eventEndDate || undefined,
  } as RawOpportunity & { eventDate?: Date | null; eventEndDate?: Date | null };
}

export class EventbriteSource implements OpportunitySource {
  name = "Eventbrite Events";
  platform = "Eventbrite" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[Eventbrite] Scraping public event listings...");

    const results: RawOpportunity[] = [];
    const seen = new Set<string>();

    for (const pageUrl of SEARCH_PAGES) {
      try {
        const res = await fetch(pageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.warn(`[Eventbrite] ${pageUrl} returned ${res.status}`);
          continue;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        // Try __NEXT_DATA__ first
        const nextData = $("script#__NEXT_DATA__").html();
        if (nextData) {
          try {
            const data = JSON.parse(nextData);
            const events = data?.props?.pageProps?.search_data?.events || [];
            for (const event of events) {
              const ev = event.event || event;
              const mapped = parseEvent(ev, $);
              if (!mapped) continue;
              const key = mapped.sourceId || mapped.title;
              if (seen.has(key)) continue;
              seen.add(key);
              results.push(mapped);
            }
          } catch { /* JSON parse failed, fall through to HTML scraping */ }
        }

        // Scrape HTML cards with HTML passed for JSON-LD date extraction
        $("[class*='event-card'], [class*='DiscoverVerticalEventCard'], article, .search-event-card-wrapper").each((_, el) => {
          const mapped = parseEvent(el, $, html);
          if (!mapped) return;
          const key = mapped.sourceId || mapped.title;
          if (seen.has(key)) return;
          seen.add(key);
          results.push(mapped);
        });

        console.log(`[Eventbrite] ${pageUrl.split("/").filter(Boolean).slice(-2).join("/")}: ${results.length} total`);
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`[Eventbrite] Error on ${pageUrl}:`, err);
      }
    }

    console.log(`[Eventbrite] Total events fetched: ${results.length}`);
    return results;
  }
}
