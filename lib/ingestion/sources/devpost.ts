import { RawOpportunity, OpportunitySource } from "@/types/opportunity";

/**
 * Devpost Source Adapter
 *
 * Uses Devpost's internal JSON API (same endpoint the website uses)
 * to get live hackathon listings. Returns structured JSON — no HTML parsing needed.
 *
 * Extracts: title, description, deadline, imageUrl, eventDate, eventEndDate,
 * location, organization, prize amount.
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
          const organization = String(h.organization_name ?? displayedLocation?.location ?? "Devpost").trim();
          const description = String(h.tagline ?? h.description ?? title).substring(0, 2000);
          const location = String(displayedLocation?.location ?? (h.online ? "Online" : "In-Person")).trim() || "Online";

          // ── Image extraction ─────────────────────────────────────────
          const imageUrl = extractImage(h);

          // ── Date extraction ──────────────────────────────────────────
          // submission_period_dates is typically "Aug 20 – Sep 10, 2026"
          let eventDate: Date | null = null;
          let eventEndDate: Date | null = null;
          let registrationDeadline: Date | null = null;

          const periodDates = h.submission_period_dates ? String(h.submission_period_dates) : null;
          if (periodDates) {
            const parts = periodDates.split("–").map((s: string) => s.trim());
            if (parts.length === 2) {
              const startParsed = new Date(parts[0]);
              const endParsed = new Date(parts[1]);
              if (!isNaN(startParsed.getTime())) eventDate = startParsed;
              if (!isNaN(endParsed.getTime())) {
                eventEndDate = endParsed;
                registrationDeadline = endParsed; // submission deadline = registration deadline
              }
            }
          }

          // Fallback: explicit deadline fields
          if (!registrationDeadline && h.registrations_close_at) {
            const parsed = new Date(String(h.registrations_close_at));
            if (!isNaN(parsed.getTime())) registrationDeadline = parsed;
          }

          const deadline = registrationDeadline;
          const slug = String(h.url ?? "").split("devpost.com/").pop()?.replace(/\/$/, "") ?? title;
          const prize = h.prize_amount ? `Prize: $${h.prize_amount}` : null;

          opportunities.push({
            title,
            organization,
            category: "Hackathon",
            location,
            description: prize ? `${description}\n\n${prize}` : description,
            applicationLink: applicationLink || `https://devpost.com/hackathons`,
            imageUrl: imageUrl || undefined,
            deadline,
            deadlineKind: deadline ? "source_provided" : "unavailable",
            source: "Devpost",
            sourceUrl: applicationLink || `https://devpost.com/hackathons`,
            sourcePlatform: "Devpost",
            sourceId: slug,
            tags: ["hackathon", "devpost"],
            // Extended fields (stored as extra props on the raw object)
            eventDate,
            eventEndDate,
            registrationDeadline,
          } as RawOpportunity & { eventDate?: Date | null; eventEndDate?: Date | null; registrationDeadline?: Date | null });
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

/** Extract the best available image from a Devpost hackathon JSON object. */
function extractImage(h: Record<string, unknown>): string | null {
  // Try thumbnail first (high-res event image)
  for (const key of ["thumbnail_url", "thumbnail", "cover_image_url", "logo_url", "logo"]) {
    const val = h[key];
    if (typeof val === "string" && val.startsWith("http")) return val;
  }
  // Try nested themes/photos
  const themes = h.themes as Record<string, unknown>[] | undefined;
  if (Array.isArray(themes)) {
    for (const theme of themes) {
      if (typeof theme.background_image_url === "string" && theme.background_image_url.startsWith("http")) {
        return theme.background_image_url;
      }
    }
  }
  return null;
}
