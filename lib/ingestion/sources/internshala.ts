import * as cheerio from "cheerio";
import { RawOpportunity, OpportunitySource } from "@/types/opportunity";
import { resolveImageUrl } from "@/lib/images";

/**
 * Internshala Source Adapter
 *
 * Scrapes Internshala's public internship listings from the server-rendered
 * listing page. Each card provides structured data that we extract and normalize.
 *
 * Available from listing page HTML:
 * - title, organization, location, stipend, duration
 * - full description/responsibilities (.about_job .text)
 * - skills (.job_skill)
 * - posted date (relative: "1 week ago")
 * - employment type (data attribute)
 * - image, source URL, source ID
 *
 * NOT available from listing page (detail page is client-side SPA):
 * - start date, application deadline / "Apply by"
 *
 * DIAGNOSIS (Sep 2026):
 * - All category URLs return the same inventory.
 * - The main listing page (/internships/) returns identical results.
 * - Pagination works: page-N/ returns 40 unique cards per page.
 * - Page 1 returns 50 cards; pages 2+ return 40 cards.
 * - ~7,149 internships across ~179 pages.
 *
 * STRATEGY:
 * - Use the single main listing page with pagination.
 * - Fetch bounded pages per run (incremental).
 * - Deduplicate by canonical Internshala URL.
 */

/** Base URL for the main internship listing */
const BASE_URL = "https://internshala.com/internships/";

/** Maximum pages to fetch per run. 25 pages ≈ 1,000 internships. */
const MAX_PAGES = 25;

/** Delay between requests (ms) to be polite */
const PAGE_DELAY_MS = 400;

/** Default tags applied to all Internshala listings */
const BASE_TAGS = ["internship", "internshala"];

/**
 * Extract role-specific tags from an Internshala opportunity title.
 * Falls back to the category-level baseTags when no specific match is found.
 */
function extractRoleTags(title: string): string[] {
  const lower = title.toLowerCase();
  const tags: string[] = [];

  // AI / ML roles
  if (/\b(ai|machine learning|ml|deep learning|artificial intelligence|nlp|natural language|computer vision|data science|data analyst|analytics|llm|genai|generative)\b/.test(lower)) {
    tags.push("ai", "machine-learning", "python");
  }

  // Software Engineering roles
  if (/\b(software|developer|engineer|programming|coding|backend|frontend|full.?stack|swe|technical)\b/.test(lower)) {
    tags.push("software-engineering");
    if (/\b(python|java|c\+\+|golang|rust|node|spring|django)\b/.test(lower)) tags.push("backend");
    if (/\b(react|angular|vue|frontend|front.?end|ui)\b/.test(lower)) tags.push("frontend");
  }

  // Web Development roles
  if (/\b(web|frontend|front.?end|backend|back.?end|full.?stack|react|angular|vue|node|javascript|typescript|html|css|php|django|flask|next\.?js)\b/.test(lower)) {
    tags.push("web-development");
    if (/\b(react|angular|vue|frontend|front.?end|ui|html|css)\b/.test(lower)) tags.push("frontend");
    if (/\b(node|django|flask|backend|back.?end|php|api)\b/.test(lower)) tags.push("backend");
  }

  // Data Science roles
  if (/\b(data science|data scientist|data analyst|analytics|bi |business intelligence)\b/.test(lower)) {
    tags.push("data-science", "analytics", "python");
  }

  // Design roles
  if (/\b(design|ui|ux|figma|graphic|visual|product design|creative)\b/.test(lower)) {
    tags.push("design", "ui-ux");
    if (/\b(graphic|visual|illustration|photoshop|illustrator)\b/.test(lower)) tags.push("graphic-design");
  }

  // Marketing roles
  if (/\b(marketing|digital marketing|social media|seo|sem|content marketing|growth|brand)\b/.test(lower)) {
    tags.push("marketing", "growth");
    if (/\b(seo|sem|search engine)\b/.test(lower)) tags.push("seo");
    if (/\b(social media|instagram|linkedin)\b/.test(lower)) tags.push("social-media");
  }

  // Content Writing roles
  if (/\b(content|writing|copywriting|copywriter|editorial|editor|blog|technical writing)\b/.test(lower)) {
    tags.push("content", "writing", "copywriting");
  }

  // HR roles
  if (/\b(hr|human resources?|recruiting|recruitment|talent acquisition|people|people operations)\b/.test(lower)) {
    tags.push("human-resources", "recruiting");
  }

  // Sales roles
  if (/\b(sales|business development|b2b|account|revenue|lead generation)\b/.test(lower)) {
    tags.push("sales", "business-development");
  }

  // Finance roles
  if (/\b(finance|accounting|financial|investment|banking|audit|tax)\b/.test(lower)) {
    tags.push("finance", "accounting");
  }

  // Business / Operations roles
  if (/\b(business|operations|strategy|consulting|management|project management)\b/.test(lower)) {
    tags.push("business", "operations");
  }

  // Customer Service roles
  if (/\b(customer|support|service|helpdesk|call center|telecalling)\b/.test(lower)) {
    tags.push("customer-service", "support");
  }

  // Cybersecurity roles
  if (/\b(cybersecurity|cyber security|infosec|penetration|vulnerability|encryption|security engineer)\b/.test(lower)) {
    tags.push("cybersecurity", "security");
  }

  // Mobile Development roles
  if (/\b(mobile|android|ios|swift|kotlin|flutter|react native)\b/.test(lower)) {
    tags.push("mobile", "app-development");
  }

  // DevOps roles
  if (/\b(devops|cloud|aws|azure|gcp|docker|kubernetes|sre|infrastructure)\b/.test(lower)) {
    tags.push("devops", "cloud");
  }

  // Data Annotation / QA / Testing
  if (/\b(data annotation|labeling|labelling)\b/.test(lower)) {
    tags.push("data-annotation", "ai");
  }
  if (/\b(qa|quality assurance|testing|test engineer|sDET)\b/.test(lower)) {
    tags.push("qa", "testing", "quality-assurance");
  }

  // Always add internship tag
  tags.push("internship");

  return [...new Set([...tags, "internshala"])];
}

/**
 * Normalize location from Internshala's raw location text.
 * Handles: "Work from home", "Mumbai (Hybrid)", "Delhi (Remote)", etc.
 */
function normalizeInternshalaLocation(rawLocation: string): { location: string; isRemote: boolean } {
  if (!rawLocation) return { location: "See posting", isRemote: false };

  const cleaned = rawLocation.replace(/\s+/g, " ").trim();

  // Work from home → Remote
  if (/work\s*from\s*home/i.test(cleaned)) {
    return { location: "Remote", isRemote: true };
  }

  // Explicit Remote
  if (/^remote$/i.test(cleaned)) {
    return { location: "Remote", isRemote: true };
  }

  // Extract city from patterns like "Mumbai (Hybrid)" or "Delhi (Remote)"
  const cityMatch = cleaned.match(/^([^(]+?)\s*\((Hybrid|Remote|On[- ]site)\)\s*$/i);
  if (cityMatch) {
    const city = cityMatch[1].trim();
    const arrangement = cityMatch[2].toLowerCase();
    // Return city + arrangement for hybrid
    if (arrangement === "hybrid") {
      return { location: `${city} (Hybrid)`, isRemote: false };
    }
    if (arrangement === "remote") {
      return { location: "Remote", isRemote: true };
    }
    return { location: city, isRemote: false };
  }

  // Clean city name (strip trailing parentheticals like "(Hybrid)")
  const stripped = cleaned.replace(/\s*\((?:Hybrid|Remote|On[- ]site)\)\s*$/i, "").trim();
  if (stripped) {
    return { location: stripped, isRemote: false };
  }

  return { location: cleaned, isRemote: false };
}

/**
 * Parse a single Internshala card element into a RawOpportunity.
 * Returns null if the card is invalid or missing required fields.
 */
function parseCard(
  $: cheerio.CheerioAPI,
  el: any,
): RawOpportunity | null {
  const $el = $(el);

  // ── Required: title ──
  const title = $el.find("h2.job-internship-name").first().text().trim();
  if (!title || title.length < 3) return null;

  // ── Required: link (canonical URL → source ID) ──
  const href = $el.find("a.job-title-href").first().attr("href")
    || $el.attr("data-href")
    || "";
  if (!href) return null;

  const fullLink = !href ? "" : href.startsWith("http")
    ? href
    : `https://internshala.com${href}`;

  // Only accept individual internship detail pages
  if (!fullLink || (!fullLink.includes("/internship/detail/") && !fullLink.includes("/internships/detail/"))) {
    return null;
  }

  // ── Company (clean whitespace) ──
  const organization = $el.find(".company-name").first().text().trim().replace(/\s+/g, " ") || "Unknown";

  // ── Location ──
  const rawLocation = $el.find(".locations").first().text().trim().replace(/\s+/g, " ");
  const { location: normalizedLocation, isRemote } = normalizeInternshalaLocation(rawLocation);

  // ── Stipend ──
  const stipend = $el.find(".stipend").first().text().trim().replace(/\s+/g, " ") || undefined;

  // ── Duration ──
  let duration: string | undefined;
  const detailText = $el.find(".individual_internship_details").text();
  const durationMatch = detailText.match(/\b(\d+\s*(?:Month|Week|Day|Year)s?)\b/i);
  if (durationMatch) {
    duration = durationMatch[1].trim();
  }

  // ── Description (from the actual listing, not synthetic) ──
  const aboutText = $el.find(".about_job .text").text().trim().replace(/\s+/g, " ");
  // If the listing has a full description, use it
  // Otherwise, build a minimal one from available structured data
  let description: string;
  if (aboutText && aboutText.length > 20) {
    description = aboutText.substring(0, 2000);
  } else {
    // Fallback: minimal structured description (do NOT fabricate details)
    const parts: string[] = [];
    if (stipend) parts.push(`Stipend: ${stipend}`);
    if (duration) parts.push(`Duration: ${duration}`);
    if (normalizedLocation !== "See posting") parts.push(`Location: ${normalizedLocation}`);
    description = parts.length > 0 ? parts.join(". ") + "." : `Internship at ${organization}.`;
  }

  // ── Skills ──
  const skills: string[] = [];
  $el.find(".job_skill").each((_, skillEl) => {
    const skill = $(skillEl).text().trim();
    if (skill) skills.push(skill);
  });

  // ── Posted date (relative: "1 week ago", "2 days ago") ──
  let sourcePublishedAt: string | null = null;
  const postedEl = $el.find(".status-inactive span").first();
  if (postedEl.length) {
    const postedText = postedEl.text().trim();
    if (postedText && /\d+\s*(minute|hour|day|week|month|year)s?\s*ago/i.test(postedText)) {
      sourcePublishedAt = postedText;
    }
  }

  // ── Employment type (from data attribute) ──
  const employmentType = $el.attr("employment_type") || undefined;

  // ── Job offer mention ──
  const hasJobOffer = /job offer/i.test(detailText);

  // ── Actively hiring badge ──
  const isActivelyHiring = $el.find(".actively-hiring-badge").length > 0;

  // ── Image ──
  const rawImg = $el.find(".internship_logo img").first().attr("src")
    || $el.find("img").first().attr("src")
    || undefined;
  const imageUrl = rawImg ? resolveImageUrl(rawImg, "https://internshala.com") || undefined : undefined;

  // ── Generate source ID from URL slug ──
  const slug = (href || "").split("/").filter(Boolean).pop() || "";
  const sourceId = slug ? `internshala-${slug}` : `internshala-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  // ── Tags ──
  const roleTags = extractRoleTags(title);

  return {
    title,
    organization,
    category: "Internship" as const,
    location: normalizedLocation,
    description,
    applicationLink: fullLink,
    imageUrl: imageUrl && !imageUrl.includes("placeholder") ? imageUrl : undefined,
    deadline: null,
    deadlineKind: "unavailable" as const,
    source: "Internshala",
    sourceUrl: fullLink,
    sourcePlatform: "Internshala",
    sourceId,
    tags: roleTags,
    // Structured metadata extracted from listing page
    stipend: stipend || undefined,
    duration: duration || undefined,
    // Additional structured fields
    employmentType: employmentType || undefined,
    sourcePublishedAt: sourcePublishedAt || undefined,
    isRemote,
  } as any;
}

/**
 * Fetch a single page of Internshala listings.
 * Returns an array of parsed opportunities (may be empty if no cards found).
 */
async function fetchPage(pageNum: number): Promise<RawOpportunity[]> {
  const url = pageNum === 1
    ? BASE_URL
    : `${BASE_URL}page-${pageNum}/`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    console.warn(`[Internshala] Page ${pageNum} returned ${response.status}`);
    return [];
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const opportunities: RawOpportunity[] = [];

  $("div.individual_internship").each((_, el) => {
    const opp = parseCard($, el);
    if (opp) opportunities.push(opp);
  });

  return opportunities;
}

export class InternshalaSource implements OpportunitySource {
  name = "Internshala";
  platform = "Internshala" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log(`[Internshala] Starting ingestion (max ${MAX_PAGES} pages)...`);

    const allOpportunities: RawOpportunity[] = [];
    const seenUrls = new Set<string>();
    let consecutiveEmptyPages = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const opportunities = await fetchPage(page);

        let newCount = 0;
        for (const opp of opportunities) {
          // Deduplicate by canonical Internshala URL (stable identity)
          const key = opp.sourceId || opp.title;
          if (seenUrls.has(key)) continue;
          seenUrls.add(key);
          allOpportunities.push(opp);
          newCount++;
        }

        console.log(
          `[Internshala] Page ${page}: ${opportunities.length} cards, ${newCount} new (total: ${allOpportunities.length})`,
        );

        // Stop if no new unique listings found
        if (newCount === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 2) {
            console.log(`[Internshala] ${consecutiveEmptyPages} consecutive empty/duplicate pages — stopping.`);
            break;
          }
        } else {
          consecutiveEmptyPages = 0;
        }

        // Polite delay between pages
        if (page < MAX_PAGES) {
          await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
        }
      } catch (err) {
        console.warn(`[Internshala] Error on page ${page}:`, err);
        // Don't kill the entire source — continue with next page
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 3) {
          console.warn(`[Internshala] Too many consecutive errors — stopping.`);
          break;
        }
      }
    }

    console.log(
      `[Internshala] Complete: ${allOpportunities.length} unique internships from ${MAX_PAGES} max pages`,
    );
    return allOpportunities;
  }
}
