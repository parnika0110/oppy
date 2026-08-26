import * as cheerio from "cheerio";
import { RawOpportunity, OpportunitySource } from "@/types/opportunity";

/**
 * Luma Source Adapter (real calendar scraper)
 *
 * Luma has no public search API, but individual calendar pages
 * (lu.ma/<calendar-slug>) are public and server-render a Next.js
 * `__NEXT_DATA__` JSON blob containing the upcoming event list.
 * We fetch each configured calendar page and parse that blob directly —
 * no headless browser needed, no bot-protection triggered.
 *
 * Configure calendars via the LUMA_CALENDARS env var, comma-separated
 * slugs, e.g. LUMA_CALENDARS="buildclub,frontier-tower,south-park-commons"
 *
 * There is NO default calendar list. Guessing arbitrary communities means
 * publishing events nobody asked to track. If LUMA_CALENDARS is unset or
 * empty, this source is NOT CONFIGURED and returns zero results — the same
 * pattern JSearch follows when RAPIDAPI_KEY is missing.
 */

export function getCalendarSlugs(): string[] {
  const configured = process.env.LUMA_CALENDARS;
  if (!configured || !configured.trim()) return [];
  return configured.split(",").map((s) => s.trim()).filter(Boolean);
}

export function isLumaConfigured(): boolean {
  return getCalendarSlugs().length > 0;
}

// Recursively search a parsed JSON tree for arrays of event-like objects.
// Luma's __NEXT_DATA__ shape shifts between releases, so rather than
// hardcoding a brittle path we walk the tree looking for objects that look
// like events (api_id/name/start_at or similar fields).
function findEventObjects(node: any, depth = 0, out: any[] = []): any[] {
  if (!node || depth > 8) return out;
  if (Array.isArray(node)) {
    for (const item of node) findEventObjects(item, depth + 1, out);
    return out;
  }
  if (typeof node === "object") {
    const looksLikeEvent =
      (node.api_id || node.event_api_id || node.id) &&
      (node.name || node.title) &&
      (node.start_at || node.startAt || node.start_time);
    if (looksLikeEvent) {
      out.push(node);
    }
    for (const key of Object.keys(node)) {
      findEventObjects(node[key], depth + 1, out);
    }
  }
  return out;
}

function extractLocation(event: any): string {
  const geo = event.geo_address_json || event.geoAddress || event.location;
  if (typeof geo === "string") return geo;
  if (geo?.city_state) return geo.city_state;
  if (geo?.city) return [geo.city, geo.region].filter(Boolean).join(", ");
  if (event.is_online || event.isOnline) return "Online";
  return "See event page";
}

function mapEvent(event: any, calendarSlug: string): RawOpportunity | null {
  const title: string = event.name || event.title;
  const apiId: string = event.api_id || event.event_api_id || event.id;
  const urlSlug: string = event.url || event.slug || apiId;
  if (!title || !apiId) return null;

  const startAtRaw = event.start_at || event.startAt || event.start_time;
  const eventDate = startAtRaw ? new Date(startAtRaw) : null;

  // Skip events that have already happened
  if (eventDate && eventDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return null;
  }

  const applicationLink = urlSlug?.startsWith("http")
    ? urlSlug
    : `https://lu.ma/${urlSlug || apiId}`;

  const coverUrl: string | null =
    event.cover_url || event.coverUrl || event.image_url || null;

  return {
    title,
    organization: event.calendar_name || event.hostName || "Luma Community",
    category: "Event",
    location: extractLocation(event),
    tags: ["Networking", "Tech", "Community"],
    description:
      event.description_short ||
      event.description ||
      "See the Luma event page for full details.",
    applicationLink,
    imageUrl: coverUrl,
    deadline: null,
    // An event without an explicit registration/application deadline is not
    // "rolling" — rolling means the source affirmatively has no closing date
    // (e.g. an ongoing program). Luma simply doesn't expose deadline data at
    // all, so the honest label is "unavailable", not an inferred rolling status.
    deadlineKind: "unavailable",
    source: "Luma",
    sourceUrl: applicationLink,
    sourcePlatform: "Luma",
    sourceId: `luma-${calendarSlug}-${apiId}`,
    ...(eventDate ? { eventDate } : {}),
  } as RawOpportunity & { eventDate?: Date };
}

async function fetchCalendar(slug: string): Promise<RawOpportunity[]> {
  const url = `https://lu.ma/${slug}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; OppyBot/1.0; +https://oppy.app)",
      Accept: "text/html",
    },
    // Always fetch fresh — this is a scheduled ingestion job
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const nextDataRaw = $("#__NEXT_DATA__").html();
  if (!nextDataRaw) {
    console.warn(`[Luma] "${slug}": no __NEXT_DATA__ payload found (page structure may have changed)`);
    return [];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(nextDataRaw);
  } catch (err) {
    console.warn(`[Luma] "${slug}": failed to parse __NEXT_DATA__ JSON`);
    return [];
  }

  const rawEvents = findEventObjects(parsed);
  const seen = new Set<string>();
  const opportunities: RawOpportunity[] = [];

  for (const ev of rawEvents) {
    const mapped = mapEvent(ev, slug);
    if (!mapped || !mapped.sourceId) continue;
    if (seen.has(mapped.sourceId)) continue;
    seen.add(mapped.sourceId);
    opportunities.push(mapped);
  }

  return opportunities;
}

export class LumaSource implements OpportunitySource {
  name = "Luma Events";
  platform = "Luma" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const slugs = getCalendarSlugs();

    if (slugs.length === 0) {
      console.warn(
        "[Luma] LUMA_CALENDARS not configured — skipping. Set LUMA_CALENDARS in .env.local " +
          '(comma-separated slugs, e.g. "buildclub,frontier-tower") to enable Luma discovery.'
      );
      return [];
    }

    console.log(`[Luma] Fetching ${slugs.length} calendar(s): ${slugs.join(", ")}`);

    const results: RawOpportunity[] = [];

    for (const slug of slugs) {
      try {
        const events = await fetchCalendar(slug);
        console.log(`[Luma] "${slug}": ${events.length} upcoming event(s)`);
        results.push(...events);
      } catch (err: any) {
        console.error(`[Luma] "${slug}" failed:`, err?.message || err);
      }

      // Polite delay between calendar page fetches
      await new Promise((r) => setTimeout(r, 400));
    }

    console.log(`[Luma] Total fetched: ${results.length}`);
    return results;
  }
}
