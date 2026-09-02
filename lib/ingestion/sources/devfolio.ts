import * as cheerio from "cheerio";
import { RawOpportunity, OpportunitySource } from "@/types/opportunity";
import { resolveImageUrl } from "@/lib/images";

/**
 * MLH + Devfolio Source Adapter
 *
 * MLH publishes a public events page at https://mlh.io/seasons/2025/events
 * Devfolio exposes hackathon data via __NEXT_DATA__ JSON.
 *
 * Now extracts: images, event dates, registration deadlines.
 */
export class DevfolioSource implements OpportunitySource {
  name = "Devfolio Hackathons";
  platform = "Devfolio" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const results: RawOpportunity[] = [];

    // Source 1: MLH Events
    try {
      const mlhResults = await this.fetchMLH();
      results.push(...mlhResults);
      console.log(`[MLH] Fetched ${mlhResults.length} events.`);
    } catch (err) {
      console.error("[MLH] Failed:", err);
    }

    // Source 2: Devfolio explore page (HTML)
    try {
      const devfolioResults = await this.fetchDevfolio();
      results.push(...devfolioResults);
      console.log(`[Devfolio] Fetched ${devfolioResults.length} hackathons.`);
    } catch (err) {
      console.error("[Devfolio] Failed:", err);
    }

    return results;
  }

  private async fetchMLH(): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];
    const YEAR = new Date().getFullYear();

    for (const season of [`${YEAR}`, `${YEAR + 1}`]) {
      try {
        const response = await fetch(`https://www.mlh.com/seasons/${season}/events`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          console.warn(`[MLH] Season ${season} returned ${response.status}`);
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // MLH event cards
        $(".event-wrapper, .event, [class*='event']").each((_, el) => {
          const $el = $(el);

          const title = $el.find(".event-name, h3, h4, [class*='name']").first().text().trim();
          if (!title) return;

          const link = $el.find("a").first().attr("href") || "";
          const fullLink = link.startsWith("http") ? link : `https://mlh.io${link}`;

          // Skip if the link is just the MLH homepage (not a specific event)
          if (fullLink === "https://mlh.io/" || fullLink === "https://mlh.io") return;

          // Image extraction — resolve relative URLs against mlh.io
          const rawImg = $el.find("img").first().attr("src") || $el.find("[style*='background']").first().attr("style")?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || null;
          const imageUrl = resolveImageUrl(rawImg, "https://mlh.io") || undefined;

          const dateText = $el.find(".event-date, [class*='date'], time").first().text().trim();
          let eventDate: Date | null = null;
          if (dateText) {
            const parsed = new Date(dateText);
            if (!isNaN(parsed.getTime())) eventDate = parsed;
          }

          const location = $el.find(".event-location, [class*='location']").first().text().trim() || "In-Person / Online";

          opportunities.push({
            title,
            organization: "MLH",
            category: "Hackathon",
            location,
            description: `Official MLH hackathon: ${title}. MLH (Major League Hacking) is the official student hackathon league.`,
            applicationLink: fullLink,
            imageUrl,
            deadline: null,
            deadlineKind: eventDate ? "source_provided" : "unavailable",
            source: "MLH",
            sourceUrl: fullLink,
            sourcePlatform: "Other",
            sourceId: `mlh-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            tags: ["hackathon", "mlh", "student"],
            eventDate,
          } as RawOpportunity & { eventDate?: Date | null });
        });

        if (opportunities.length > 0) break; // Got results, no need for next season
      } catch (err) {
        console.warn(`[MLH] Season ${season} error:`, err);
      }
    }

    return opportunities;
  }

  private async fetchDevfolio(): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];

    const response = await fetch("https://devfolio.co/hackathons", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[Devfolio] Page returned ${response.status}`);
      return opportunities;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to extract from __NEXT_DATA__ JSON embedded in the page
    const nextDataScript = $("script#__NEXT_DATA__").text();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        // Navigate the Next.js data tree to find hackathons
        const hackathons =
          nextData?.props?.pageProps?.hackathons ||
          nextData?.props?.pageProps?.data?.hackathons ||
          [];

        for (const h of hackathons) {
          const title = String(h.name ?? h.title ?? "").trim();
          if (!title) continue;

          const slug = h.slug ?? title.toLowerCase().replace(/\s+/g, "-");
          const applicationLink = `https://devfolio.co/hackathons/${slug}`;

          // ── Date extraction ────────────────────────────────────────
          const eventDate = parseDate(h.starts_at);
          const eventEndDate = parseDate(h.ends_at);
          const registrationDeadline = parseDate(h.hackathon_setting?.reg_ends_at ?? h.reg_ends_at);

          // Use registration deadline as the primary deadline if available
          const deadline = registrationDeadline || eventEndDate;

          // ── Image extraction ────────────────────────────────────────
          const imageUrl = h.cover_image ?? h.logo ?? h.image_url ?? null;

          opportunities.push({
            title,
            organization: h.org_name ?? "Devfolio",
            category: "Hackathon",
            location: h.is_online ? "Online" : (h.city ?? "India"),
            description: String(h.desc ?? h.tagline ?? title).substring(0, 2000),
            applicationLink,
            imageUrl: imageUrl || undefined,
            deadline,
            deadlineKind: deadline ? "source_provided" : "unavailable",
            source: "Devfolio",
            sourceUrl: applicationLink,
            sourcePlatform: "Devfolio",
            sourceId: slug,
            tags: ["hackathon", "devfolio"],
            eventDate,
            eventEndDate,
            registrationDeadline,
          } as RawOpportunity & { eventDate?: Date | null; eventEndDate?: Date | null; registrationDeadline?: Date | null });
        }
      } catch {
        // JSON parse failed — fall through to link scraping
      }
    }

    // Fallback: scrape links
    if (opportunities.length === 0) {
      $("a[href*='/hackathons/']").each((_, el) => {
        const link = $(el).attr("href") ?? "";
        if (!link || link === "/hackathons" || link === "/hackathons/") return;

        const title = $(el).find("h3, h4, [class*='name'], [class*='title']").first().text().trim()
          || $(el).text().trim();
        if (!title || title.length < 3) return;

        const slug = link.split("/hackathons/")[1]?.replace(/\/$/, "") || "";
        // Navigation/category URLs are not event listings and must never enter Browse.
        if (!slug || ["applied", "open", "upcoming", "past", "all"].includes(slug.toLowerCase())) return;
        const fullUrl = link.startsWith("http") ? link : `https://devfolio.co${link}`;

        // Try to extract image from link card — also check CSS background-image
        const rawImg =
          $(el).find("img").first().attr("src") ||
          $(el).find("[style*='background-image']").first().attr("style")?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] ||
          null;
        const imageUrl = resolveImageUrl(rawImg, "https://devfolio.co") || undefined;

        opportunities.push({
          title,
          organization: "Devfolio",
          category: "Hackathon",
          location: "Online",
          description: `Hackathon on Devfolio: ${title}`,
          applicationLink: fullUrl,
          imageUrl,
          deadline: null,
          deadlineKind: "unavailable",
          source: "Devfolio",
          sourceUrl: fullUrl,
          sourcePlatform: "Devfolio",
          sourceId: slug,
          tags: ["hackathon", "devfolio"],
        });
      });
    }

    return opportunities;
  }
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}
