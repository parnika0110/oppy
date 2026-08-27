import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * Hacker News "Who is Hiring?" Source Adapter
 *
 * Parses the monthly "Ask HN: Who is hiring?" threads on Hacker News.
 * Each comment is a real job posting from a real company.
 *
 * Uses the official HN Algolia API (no auth needed).
 */

const HN_API = "https://hn.algolia.com/api/v1";
const HN_ITEM_URL = "https://news.ycombinator.com/item";

function mapCategory(title: string): Category {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "Internship";
  if (t.includes("hiring")) return "Job";
  return "Job";
}

function parseComment(comment: string, storyTitle: string): { title: string; tags: string[] } | null {
  const lines = comment.split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim();

  // Most HN hiring comments start with "Company | Role | Location | ..."
  // or just the company name
  const pipeParts = firstLine.split("|").map((s) => s.trim());

  let company = pipeParts[0] || "Unknown";
  let role = pipeParts[1] || "";

  // Clean up company/role
  company = company.replace(/^[-•*]\s*/, "").trim();
  role = role.trim();

  if (!company || company.length < 2) return null;

  // Skip meta/admin comments
  const lower = firstLine.toLowerCase();
  if (
    lower.includes("who is hiring") ||
    lower.includes("who wants to be hired") ||
    lower.includes("freelancer") ||
    lower.includes("seeking cofounder") ||
    lower.startsWith("reply") ||
    lower.startsWith("thread")
  ) {
    return null;
  }

  const title = role ? `${role} — ${company}` : `${company} (hiring)`;

  // Extract semantic tags from content
  const tags: string[] = [];
  const contentLower = comment.toLowerCase();
  const roleLower = role.toLowerCase();

  // ── Domain tags (from role title and comment) ──
  if (/\b(ml|machine learning|ai|artificial intelligence|deep learning|nlp|computer vision|llm|data scien)/.test(roleLower + ' ' + contentLower)) {
    tags.push("ai/ml");
  }
  if (/\b(frontend|front-end|ui |react |vue |angular |css |html )/.test(roleLower + ' ' + contentLower)) {
    tags.push("frontend");
  }
  if (/\b(backend|back-end|server|api |infrastructure|distributed)/.test(roleLower + ' ' + contentLower)) {
    tags.push("backend");
  }
  if (/\b(full.?stack|fullstack)/.test(roleLower + ' ' + contentLower)) {
    tags.push("full-stack");
  }
  if (/\b(devops|sre|infra|cloud|kubernetes|docker|terraform)/.test(contentLower)) {
    tags.push("devops");
  }
  if (/\b(security|infosec|cyber|pentest)/.test(contentLower)) {
    tags.push("security");
  }
  if (/\b(mobile|ios|android|swift|kotlin|flutter|react native)/.test(contentLower)) {
    tags.push("mobile");
  }
  if (/\b(data |analytics|etl|pipeline|warehouse|spark)/.test(contentLower)) {
    tags.push("data");
  }
  if (/\b(product|pm |product manager|product design)/.test(roleLower + ' ' + contentLower)) {
    tags.push("product");
  }
  if (/\b(design|designer|ux|ui design|figma|visual)/.test(roleLower + ' ' + contentLower)) {
    tags.push("design");
  }

  // ── Technology tags (top 3) ──
  const techKeywords = [
    "python", "javascript", "typescript", "rust", "go", "java",
    "react", "node", "vue", "angular", "django", "flask", "fastapi",
    "postgresql", "redis", "kafka", "aws", "gcp", "azure",
  ];
  for (const kw of techKeywords) {
    if (tags.length >= 5) break;
    try {
      const pattern = new RegExp(`\\b${kw}(\\.js)?\\b`, "i");
      if (pattern.test(contentLower) || pattern.test(roleLower)) {
        tags.push(kw === "go" ? "golang" : kw);
      }
    } catch { /* skip invalid regex */ }
  }

  // ── Work arrangement ──
  if (contentLower.includes("remote")) tags.push("remote");
  if (contentLower.includes("intern")) tags.push("internship");

  // ── Company type signals ──
  if (contentLower.includes("startup") || contentLower.includes("early stage") || contentLower.includes("seed")) {
    tags.push("startup");
  }

  return { title, tags: tags.slice(0, 6) };
}

function extractLocation(comment: string): string {
  const firstLine = comment.split("\n")[0] || "";
  const pipeParts = firstLine.split("|").map((s) => s.trim());

  // Location is usually the 3rd pipe-separated field
  if (pipeParts.length >= 3) {
    const loc = pipeParts[2];
    if (loc && !loc.match(/^(remote|onsite|hybrid|full.?time|part.?time|contract)$/i)) {
      return loc;
    }
  }

  // Fallback: check for "Remote" in first line
  if (firstLine.toLowerCase().includes("remote")) return "Remote";

  return "See posting";
}

function extractSalary(comment: string): string | null {
  const salaryMatch = comment.match(/\$[\d,]+(?:k|K)?\s*[-–—to]+\s*\$[\d,]+(?:k|K)?/);
  return salaryMatch ? salaryMatch[0] : null;
}

export class HackerNewsSource implements OpportunitySource {
  name = "Hacker News Who's Hiring";
  platform = "Other" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[HN] Fetching latest 'Who is hiring?' thread...");

    const results: RawOpportunity[] = [];
    const seen = new Set<string>();

    try {
      // Find the latest "Who is hiring?" thread
      const searchRes = await fetch(
        `${HN_API}/search?query=%22Ask%20HN%3A%20Who%20is%20hiring%22&tags=ask_hn&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 90 * 24 * 3600}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!searchRes.ok) {
        console.warn(`[HN] Search failed: ${searchRes.status}`);
        return results;
      }

      const searchData = await searchRes.json();
      const threads = searchData.hits || [];

      // Find the most recent hiring thread
      const hiringThread = threads.find((t: any) =>
        t.title?.toLowerCase().includes("who is hiring")
      );

      if (!hiringThread) {
        console.log("[HN] No recent 'Who is hiring?' thread found");
        return results;
      }

      console.log(`[HN] Found thread: "${hiringThread.title}" (${hiringThread.objectID})`);

      // Fetch comments (job postings)
      const commentsRes = await fetch(
        `${HN_API}/items/${hiringThread.objectID}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!commentsRes.ok) {
        console.warn(`[HN] Comments fetch failed: ${commentsRes.status}`);
        return results;
      }

      const commentsData = await commentsRes.json();
      const comments = commentsData.children || [];

      for (const child of comments) {
        const comment = child;
        if (!comment.text || comment.dead || comment.deleted) continue;

        // Strip HTML tags
        const cleanText = comment.text
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .trim();

        const parsed = parseComment(cleanText, hiringThread.title);
        if (!parsed) continue;

        const location = extractLocation(cleanText);
        const salary = extractSalary(cleanText);
        const description = cleanText.substring(0, 2000);
        const itemUrl = `${HN_ITEM_URL}?id=${comment.id}`;
        const isRemote = location.toLowerCase().includes("remote") ||
          cleanText.toLowerCase().includes("remote");

        const key = `${parsed.title}-${location}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const title = salary ? `${parsed.title} (${salary})` : parsed.title;

        results.push({
          title,
          organization: parsed.title.split("—").pop()?.trim() || parsed.title.split("(")[0].trim() || "YC Startup",
          category: mapCategory(parsed.title),
          location: isRemote ? "Remote" : location,
          tags: [...parsed.tags, "hacker-news", "startup"].slice(0, 6),
          description,
          applicationLink: itemUrl,
          deadline: null,
          deadlineKind: "rolling",
          source: "Hacker News",
          sourceUrl: itemUrl,
          sourcePlatform: "Other",
          sourceId: `hn-${comment.id}`,
          isRemote,
        } as RawOpportunity & { isRemote: boolean });
      }

      console.log(`[HN] Parsed ${results.length} job postings from thread`);
    } catch (err) {
      console.error("[HN] Error:", err);
    }

    return results;
  }
}
