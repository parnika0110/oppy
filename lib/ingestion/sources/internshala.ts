import * as cheerio from "cheerio";
import { RawOpportunity, OpportunitySource } from "@/types/opportunity";

/**
 * Internshala Source Adapter
 *
 * Scrapes Internshala for computer science / software engineering internships.
 */
export class InternshalaSource implements OpportunitySource {
  name = "Internshala";
  platform = "Internshala" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];
    // URL for Computer Science Internships
    const url = "https://internshala.com/internships/computer-science-internships/";

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn(`[Internshala] returned ${response.status}`);
        return opportunities;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Internshala internship cards
      $(".individual_internship").each((_, el) => {
        const $el = $(el);

        const title = $el.find(".profile").first().text().trim();
        if (!title) return;

        const organization = $el.find(".company_name").first().text().trim();
        const location = $el.find(".location_link").first().text().trim() || "Remote";
        const link = $el.attr("data-href") || $el.find(".profile > a").first().attr("href") || "";
        const fullLink = link.startsWith("http") ? link : `https://internshala.com${link}`;
        
        // Extract stipend for description
        const stipend = $el.find(".stipend").first().text().trim();
        const description = `Internship at ${organization}. ${stipend ? `Stipend: ${stipend}` : ''}`;

        // Attempt to extract image
        const imageUrl = $el.find(".internship_logo img").first().attr("src") || null;

        // Try to extract deadline if present. Often Internshala doesn't have an explicit text deadline in the listing card,
        // so we'll fallback to "unavailable" or "rolling" later.
        
        // Slug for sourceId
        const slug = link.split("/").filter(Boolean).pop() || title.toLowerCase().replace(/\s+/g, "-");

        opportunities.push({
          title,
          organization,
          category: "Internship",
          location: location.toLowerCase().includes("work from home") ? "Online" : location,
          description,
          applicationLink: fullLink,
          imageUrl: imageUrl && !imageUrl.includes("placeholder") ? imageUrl : undefined,
          deadline: null,
          deadlineKind: "rolling", // Internshala listings are generally rolling until filled/closed
          source: "Internshala",
          sourceUrl: fullLink,
          sourcePlatform: "Other",
          sourceId: `internshala-${slug}`,
          tags: ["internship", "internshala"],
        });
      });
      
      console.log(`[Internshala] Fetched ${opportunities.length} internships.`);

    } catch (err) {
      console.warn(`[Internshala] error:`, err);
    }

    return opportunities;
  }
}
