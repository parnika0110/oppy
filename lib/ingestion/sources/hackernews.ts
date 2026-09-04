import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";
import { decodeHtmlEntities } from "@/lib/html-entities";

/**
 * Hacker News "Who is Hiring?" Source Adapter
 *
 * Parses the monthly "Ask HN: Who is hiring?" threads on Hacker News.
 * Each comment is a real job posting from a real company.
 *
 * Quality filters applied:
 * - Extracts actual application/career URLs from comment text
 * - Skips senior-only roles (unless intern/early-career signal is present)
 * - Skips multi-role comments that bundle unrelated positions
 * - Cleans HTML entities from titles
 * - Improves location extraction patterns
 * - Prevents stale monthly hiring posts from remaining active indefinitely
 *
 * Uses the official HN Algolia API (no auth needed).
 */

const HN_API = "https://hn.algolia.com/api/v1";
const HN_ITEM_URL = "https://news.ycombinator.com/item";

/** HN hiring threads are monthly — close posts older than this */
export const HN_MAX_AGE_DAYS = 90;

// ── Senior-only role patterns ───────────────────────────────────────────────
// These patterns indicate roles that are NOT student/early-career friendly.
// A listing is excluded only if it matches AND contains no intern/early-career signal.
const SENIOR_ROLE_PATTERNS = /\b(engineering\s*manager|staff\s*engineer|principal\s*engineer|director|vp\s|vice\s*president|head\s+of|senior\s+staff|architect|distinguished\s*engineer)\b/i;

// ── Early-career / student-friendly signals ─────────────────────────────────
const EARLY_CAREER_SIGNALS = /\b(intern|internship|entry.level|junior|new.grad|graduate|student|early.career|associate|apprentice|bootcamp|co-op|coop)\b/i;

// ── Multi-role detection ────────────────────────────────────────────────────
// HN comments that list many unrelated roles in a single post are low quality
const MULTI_ROLE_SEPARATOR = /\s*[|•]\s*/;

// ── Application URL extraction patterns ─────────────────────────────────────
// Looks for actual application/career page URLs in the comment text.
// Prioritizes career/apply pages over generic company URLs.
const APPLICATION_URL_PATTERNS = [
  // Explicit application/apply links
  /(?:apply|application|apply here|apply now|apply at|apply via|submit|submit your|submit a)[\s:]*((?:https?:\/\/)[^\s<>"')\]]+)/i,
  // Careers pages
  /(?:careers?|jobs?|openings?|join us|join our team|we're hiring)[\s:]*((?:https?:\/\/)[^\s<>"')\]]+)/i,
  // "at https://..." or "at company.com" after role descriptions
  /(?:at|via|through|on)\s+((?:https?:\/\/)[^\s<>"')\]]+)/i,
  // Standalone URLs that are NOT HN discussion links
  /((?:https?:\/\/)(?!news\.ycombinator\.com|www\.ycombinator\.com|hn\.algolia\.com)[^\s<>"')\]]+)/i,
];

// ── Location extraction patterns ────────────────────────────────────────────
const LOCATION_PATTERNS = [
  // "Location: City, State"
  /^location:\s*(.+)/i,
  // "Based in: City"
  /^based in:\s*(.+)/i,
  // Pipe-separated: Company | Role | Location
  // (handled separately in pipe parsing)
];

function mapCategory(title: string): Category {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "Internship";
  return "Job";
}

/**
 * Extract the most relevant application URL from comment text.
 * Returns the best URL found, or null if only HN links exist.
 */
function extractApplicationUrl(comment: string): string | null {
  for (const pattern of APPLICATION_URL_PATTERNS) {
    const match = comment.match(pattern);
    if (match && match[1]) {
      const url = match[1].replace(/[.,;:!?)>\]]+$/, "").trim();
      // Skip obviously non-application URLs (images, social media profile pages, etc.)
      if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url)) continue;
      return url;
    }
  }
  return null;
}

/**
 * Detect senior-only roles.
 * Returns true if the listing appears to be ONLY for senior positions
 * with no early-career/intern signal.
 */
function isSeniorOnly(title: string, comment: string): boolean {
  const combined = title + " " + comment;
  // If there's an early-career signal, it's not senior-only
  if (EARLY_CAREER_SIGNALS.test(combined)) return false;
  // If the title/role matches senior patterns, it's senior-only
  return SENIOR_ROLE_PATTERNS.test(title);
}

/**
 * Detect if a comment bundles multiple unrelated roles.
 * Multi-role comments create misleading single opportunity records.
 */
function isMultiRoleComment(firstLine: string, comment: string): boolean {
  const pipeParts = firstLine.split(MULTI_ROLE_SEPARATOR).filter(s => s.trim().length > 2);
  // More than 4 pipe-separated fields in the first line often means multiple roles
  // OR the role field contains " & " / " and " / " / " suggesting multiple positions
  const rolePart = pipeParts.length >= 2 ? pipeParts[1] : "";
  if (/\s+&\s+|\s+and\s+|\s+\/\s+/.test(rolePart)) {
    // Check if these are genuinely separate roles (not "Full Stack / Frontend")
    const parts = rolePart.split(/\s*[&,\/]\s*|\s+and\s+/).filter(s => s.trim().length > 2);
    if (parts.length >= 3) return true;
  }
  return false;
}

function parseComment(
  comment: string,
  _storyTitle: string
): {
  title: string;
  tags: string[];
  applicationUrl: string | null;
  seniorOnly: boolean;
  multiRole: boolean;
} | null {
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
    lower.startsWith("thread") ||
    lower.startsWith("comment")
  ) {
    return null;
  }

  // Skip if no meaningful role information
  if (!role && company.length < 4) return null;

  // Check quality filters before building the opportunity
  const title = role ? `${role} — ${company}` : `${company} (hiring)`;

  const seniorOnly = isSeniorOnly(title, comment);
  const multiRole = isMultiRoleComment(firstLine, comment);

  // Extract application URL from comment text
  const applicationUrl = extractApplicationUrl(comment);

  // Extract semantic tags from content
  const tags: string[] = [];
  const contentLower = comment.toLowerCase();
  const roleLower = role.toLowerCase();

  // ── Domain tags (from role title and comment) ──
  if (/\b(ml|machine learning|ai|artificial intelligence|deep learning|nlp|computer vision|llm|data scien)/.test(roleLower + " " + contentLower)) {
    tags.push("ai/ml");
  }
  if (/\b(frontend|front-end|ui |react |vue |angular |css |html )/.test(roleLower + " " + contentLower)) {
    tags.push("frontend");
  }
  if (/\b(backend|back-end|server|api |infrastructure|distributed)/.test(roleLower + " " + contentLower)) {
    tags.push("backend");
  }
  if (/\b(full.?stack|fullstack)/.test(roleLower + " " + contentLower)) {
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
  if (/\b(product|pm |product manager|product design)/.test(roleLower + " " + contentLower)) {
    tags.push("product");
  }
  if (/\b(design|designer|ux|ui design|figma|visual)/.test(roleLower + " " + contentLower)) {
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

  return {
    title,
    tags: tags.slice(0, 6),
    applicationUrl,
    seniorOnly,
    multiRole,
  };
}

/**
 * Extract location from the comment.
 * Tries pipe-separated format first, then falls back to pattern matching.
 */
function extractLocation(comment: string): string {
  const firstLine = comment.split("\n")[0] || "";
  const pipeParts = firstLine.split("|").map((s) => s.trim());

  // Location is usually the 3rd pipe-separated field
  if (pipeParts.length >= 3) {
    const loc = pipeParts[2];
    if (loc && !loc.match(/^(remote|onsite|hybrid|full.?time|part.?time|contract)$/i)) {
      // Clean up location: strip trailing parentheticals like "(Hybrid)"
      return loc.replace(/\s*\((?:Hybrid|Remote|On[- ]site)\)\s*$/i, "").trim();
    }
  }

  // Pattern-based extraction from comment body
  for (const pattern of LOCATION_PATTERNS) {
    const match = firstLine.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }

  // Check for common location patterns in first few lines
  const firstFewLines = comment.split("\n").slice(0, 3).join(" ");

  // "NYC - hybrid" or "SF / Remote" patterns
  const cityRemote = firstFewLines.match(/\b(New York|NYC|San Francisco|SF|Seattle|Austin|Boston|Chicago|Los Angeles|LA|Denver|Portland|Miami|London|Berlin|Toronto|Singapore|Paris|Bengaluru|Bangalore|Hyderabad|Mumbai|Delhi|Pune|Chennai)\b[^.]*?(?:remote|hybrid|onsite|on-site)/i);
  if (cityRemote) return cityRemote[0].trim().substring(0, 100);

  // Fallback: check for "Remote" in first line
  if (firstLine.toLowerCase().includes("remote")) return "Remote";

  return "See posting";
}

/**
 * Extract salary/stipend information from the comment.
 * Returns a clean salary string or null.
 */
function extractSalary(comment: string): string | null {
  const salaryMatch = comment.match(/\$[\d,]+(?:k|K)?\s*[-–—to]+\s*\$[\d,]+(?:k|K)?/);
  return salaryMatch ? salaryMatch[0] : null;
}

/**
 * Clean the title by removing salary info and HTML entities.
 */
function cleanTitle(raw: string): string {
  // Remove embedded salary from title (we store it separately)
  let cleaned = raw.replace(/\s*\(\$[\d,]+(?:k|K)?\s*[-–—to]+\s*\$[\d,]+(?:k|K)?\)/, "").trim();
  // Clean HTML entities that leaked through
  cleaned = decodeHtmlEntities(cleaned);
  return cleaned;
}

export class HackerNewsSource implements OpportunitySource {
  name = "Hacker News Who's Hiring";
  platform = "Other" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[HN] Fetching latest 'Who is hiring?' thread...");

    const results: RawOpportunity[] = [];
    const seen = new Set<string>();
    let skippedSenior = 0;
    let skippedMultiRole = 0;
    let skippedNoUrl = 0;

    try {
      // Find the latest "Who is hiring?" thread
      const searchRes = await fetch(
        `${HN_API}/search?query=%22Ask%20HN%3A%20Who%20is%20hiring%22&tags=ask_hn&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - HN_MAX_AGE_DAYS * 24 * 3600}`,
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

        // Strip HTML tags, then decode all remaining HTML entities
        const cleanText = decodeHtmlEntities(
          comment.text
            .replace(/<[^>]+>/g, " ")
            .trim()
        );

        const parsed = parseComment(cleanText, hiringThread.title);
        if (!parsed) continue;

        // ── Quality filter: skip senior-only roles ──
        if (parsed.seniorOnly) {
          skippedSenior++;
          continue;
        }

        // ── Quality filter: skip multi-role comments ──
        if (parsed.multiRole) {
          skippedMultiRole++;
          continue;
        }

        // ── Quality filter: require an application URL ──
        // If no external URL was found in the comment, skip it.
        // The HN discussion URL is NOT a useful application destination.
        if (!parsed.applicationUrl) {
          skippedNoUrl++;
          continue;
        }

        const location = extractLocation(cleanText);
        const salary = extractSalary(cleanText);
        const description = cleanText.substring(0, 2000);
        const hnItemUrl = `${HN_ITEM_URL}?id=${comment.id}`;
        const isRemote = location.toLowerCase().includes("remote") ||
          cleanText.toLowerCase().includes("remote");

        // Use the extracted application URL, not the HN discussion URL
        const applicationLink = parsed.applicationUrl;

        const title = cleanTitle(
          salary ? `${parsed.title} (${salary})` : parsed.title
        );

        // Deduplicate by title + company
        const company = title.split("—").pop()?.trim() || title.split("(")[0].trim() || "Unknown";
        const key = `${title.toLowerCase()}-${company.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          title,
          organization: company,
          category: mapCategory(title),
          location: isRemote ? "Remote" : location,
          tags: [...parsed.tags, "hacker-news"].slice(0, 6),
          description,
          applicationLink,
          deadline: null,
          deadlineKind: "rolling",
          source: "Hacker News",
          sourceUrl: hnItemUrl, // Preserve HN URL as source reference
          sourcePlatform: "Other",
          sourceId: `hn-${comment.id}`,
          isRemote,
        } as RawOpportunity & { isRemote: boolean });
      }

      console.log(
        `[HN] Parsed ${results.length} job postings from thread ` +
        `(skipped: ${skippedSenior} senior-only, ${skippedMultiRole} multi-role, ${skippedNoUrl} no URL)`
      );
    } catch (err) {
      console.error("[HN] Error:", err);
    }

    return results;
  }
}
