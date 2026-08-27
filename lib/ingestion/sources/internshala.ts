import * as cheerio from "cheerio";
import { RawOpportunity, OpportunitySource } from "@/types/opportunity";
import { resolveImageUrl } from "@/lib/images";

/**
 * Internshala Source Adapter
 *
 * Scrapes Internshala for multiple internship categories:
 * - Computer Science / Software Engineering
 * - Web Development
 * - Data Science / Machine Learning
 * - UI/UX Design
 * - Marketing
 * - Business / Finance
 *
 * Internshala listings are rolling (open until filled/closed).
 */

const CATEGORY_PAGES = [
  { url: "https://internshala.com/internships/computer-science-internships/", category: "Internship", tags: ["software-engineering", "cs"] },
  { url: "https://internshala.com/internships/web-development-internships/", category: "Internship", tags: ["web-development", "frontend", "backend"] },
  { url: "https://internshala.com/internships/data-science-internships/", category: "Internship", tags: ["data-science", "ml", "analytics"] },
  { url: "https://internshala.com/internships/machine-learning-internships/", category: "Internship", tags: ["machine-learning", "ai", "deep-learning"] },
  { url: "https://internshala.com/internships/design-internships/", category: "Internship", tags: ["ui-ux", "design", "figma"] },
  { url: "https://internshala.com/internships/marketing-internships/", category: "Internship", tags: ["marketing", "growth", "seo"] },
  { url: "https://internshala.com/internships/business-internships/", category: "Internship", tags: ["business", "finance", "operations"] },
  { url: "https://internshala.com/internships/content-writing-internships/", category: "Internship", tags: ["content", "writing", "copywriting"] },
];

/**
 * Extract role-specific tags from an Internshala opportunity title.
 * Falls back to the category-level baseTags when no specific match is found.
 */
function extractRoleTags(title: string, baseTags: string[]): string[] {
  const lower = title.toLowerCase();
  const tags: string[] = [];

  // ── AI / ML roles ──
  if (/\b(ai|machine learning|ml|deep learning|artificial intelligence|nlp|natural language|computer vision|data science|data analyst|analytics|llm|genai|generative)\b/.test(lower)) {
    tags.push("ai", "machine-learning", "python");
  }

  // ── Software Engineering roles ──
  // Note: "intern" alone is NOT a software engineering signal — only
  // software/developer/engineer/etc. in the title indicates a tech role.
  if (/\b(software|developer|engineer|programming|coding|backend|frontend|full.?stack|swe|technical)\b/.test(lower)) {
    tags.push("software-engineering");
    if (/\b(python|java|c\+\+|golang|rust|node|spring|django)\b/.test(lower)) tags.push("backend");
    if (/\b(react|angular|vue|frontend|front.?end|ui)\b/.test(lower)) tags.push("frontend");
  }

  // ── Web Development roles ──
  if (/\b(web|frontend|front.?end|backend|back.?end|full.?stack|react|angular|vue|node|javascript|typescript|html|css|php|django|flask|next\.?js)\b/.test(lower)) {
    tags.push("web-development");
    if (/\b(react|angular|vue|frontend|front.?end|ui|html|css)\b/.test(lower)) tags.push("frontend");
    if (/\b(node|django|flask|backend|back.?end|php|api)\b/.test(lower)) tags.push("backend");
  }

  // ── Data Science roles ──
  if (/\b(data science|data scientist|data analyst|analytics|bi |business intelligence)\b/.test(lower)) {
    tags.push("data-science", "analytics", "python");
  }

  // ── Design roles ──
  if (/\b(design|ui|ux|figma|graphic|visual|product design|creative)\b/.test(lower)) {
    tags.push("design", "ui-ux");
    if (/\b(graphic|visual|illustration|photoshop|illustrator)\b/.test(lower)) tags.push("graphic-design");
  }

  // ── Marketing roles ──
  if (/\b(marketing|digital marketing|social media|seo|sem|content marketing|growth|brand)\b/.test(lower)) {
    tags.push("marketing", "growth");
    if (/\b(seo|sem|search engine)\b/.test(lower)) tags.push("seo");
    if (/\b(social media|instagram|linkedin)\b/.test(lower)) tags.push("social-media");
  }

  // ── Content Writing roles ──
  if (/\b(content|writing|copywriting|copywriter|editorial|editor|blog|technical writing)\b/.test(lower)) {
    tags.push("content", "writing", "copywriting");
  }

  // ── HR roles ──
  if (/\b(hr|human resources?|recruiting|recruitment|talent acquisition|people|people operations)\b/.test(lower)) {
    tags.push("human-resources", "recruiting");
  }

  // ── Sales roles ──
  if (/\b(sales|business development|b2b|account|revenue|lead generation)\b/.test(lower)) {
    tags.push("sales", "business-development");
  }

  // ── Finance roles ──
  if (/\b(finance|accounting|financial|investment|banking|audit|tax)\b/.test(lower)) {
    tags.push("finance", "accounting");
  }

  // ── Business / Operations roles ──
  if (/\b(business|operations|strategy|consulting|management|project management)\b/.test(lower)) {
    tags.push("business", "operations");
  }

  // ── Customer Service roles ──
  if (/\b(customer|support|service|helpdesk|call center|telecalling)\b/.test(lower)) {
    tags.push("customer-service", "support");
  }

  // ── Cybersecurity roles ──
  // Match full word "cybersecurity" or standalone "cyber security"
  if (/\b(cybersecurity|cyber security|infosec|penetration|vulnerability|encryption|security engineer)\b/.test(lower)) {
    tags.push("cybersecurity", "security");
  }

  // ── Mobile Development roles ──
  if (/\b(mobile|android|ios|swift|kotlin|flutter|react native)\b/.test(lower)) {
    tags.push("mobile", "app-development");
  }

  // ── DevOps roles ──
  if (/\b(devops|cloud|aws|azure|gcp|docker|kubernetes|sre|infrastructure)\b/.test(lower)) {
    tags.push("devops", "cloud");
  }

  // Always add internship tag
  tags.push("internship");

  // If no specific role matched, use baseTags as fallback
  if (tags.length <= 1) {
    return [...baseTags, "internship", "internshala"];
  }

  return [...new Set([...tags, "internshala"])];
}

export class InternshalaSource implements OpportunitySource {
  name = "Internshala";
  platform = "Internshala" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const allOpportunities: RawOpportunity[] = [];
    const seen = new Set<string>();

    for (const catPage of CATEGORY_PAGES) {
      try {
        const opportunities = await this.fetchCategory(catPage.url, catPage.category, catPage.tags);
        for (const opp of opportunities) {
          const key = opp.sourceId || opp.title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          allOpportunities.push(opp);
        }
        console.log(`[Internshala] ${catPage.url.split("/").filter(Boolean).pop()}: ${opportunities.length} internships`);
        // Polite delay between pages
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.warn(`[Internshala] Error on ${catPage.url}:`, err);
      }
    }

    console.log(`[Internshala] Total fetched: ${allOpportunities.length}`);
    return allOpportunities;
  }

  private async fetchCategory(
    url: string,
    category: string,
    baseTags: string[]
  ): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      console.warn(`[Internshala] ${url} returned ${response.status}`);
      return opportunities;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Internshala internship cards
    $(".individual_internship, .internship_card, [class*='internship']").each((_, el) => {
      const $el = $(el);

      const title = $el.find(".profile, .job-title, [class*='title'], h3").first().text().trim();
      if (!title || title.length < 3) return;

      const organization = $el.find(".company_name, .company-name, [class*='company']").first().text().trim() || "Unknown";
      const location = $el.find(".location_link, .location, [class*='location']").first().text().trim() || "Remote";
      const link = $el.attr("data-href") || $el.find(".profile > a, a[href*='/internships/']").first().attr("href") || "";
      const fullLink = link.startsWith("http") ? link : `https://internshala.com${link}`;

      // Reject category pages — only accept individual internship detail pages
      if (!fullLink.includes("/internship/detail/") && !fullLink.includes("/internships/detail/")) return;

      // Extract stipend
      const stipend = $el.find(".stipend, [class*='stipend']").first().text().trim();
      const description = `Internship at ${organization}. ${stipend ? `Stipend: ${stipend}` : ""}`;

      // Image extraction — try multiple selectors
      const rawImg =
        $el.find(".internship_logo img").first().attr("src") ||
        $el.find("img[class*='logo']").first().attr("src") ||
        $el.find("img[alt*='logo']").first().attr("src") ||
        $el.find(".company_logo img, .company-logo img").first().attr("src") ||
        $el.find("img").first().attr("src") || null;
      const imageUrl = resolveImageUrl(rawImg, "https://internshala.com") || undefined;

      const slug = link.split("/").filter(Boolean).pop() || title.toLowerCase().replace(/\s+/g, "-");

      // Generate role-specific tags from the title
      const roleTags = extractRoleTags(title, baseTags);

      opportunities.push({
        title,
        organization,
        category: category as any,
        location: location.toLowerCase().includes("work from home") || location.toLowerCase().includes("remote") ? "Remote" : location,
        description,
        applicationLink: fullLink,
        imageUrl: imageUrl && !imageUrl.includes("placeholder") ? imageUrl : undefined,
        deadline: null,
        deadlineKind: "unavailable",
        source: "Internshala",
        sourceUrl: fullLink,
        sourcePlatform: "Internshala",
        sourceId: `internshala-${slug}`,
        tags: roleTags,
      });
    });

    return opportunities;
  }
}
