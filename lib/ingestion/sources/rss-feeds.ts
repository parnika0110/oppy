import Parser from "rss-parser";
import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * Expanded RSS Source Adapter
 *
 * Aggregates RSS feeds from job boards, opportunity sites,
 * tech communities, and event platforms.
 */

interface FeedConfig {
  name: string;
  url: string;
  category: Category;
  tags: string[];
  platform: string;
  /** Optional URL to extract opportunity links from feed items */
  linkExtractor?: (item: any) => string | null;
  /** Optional filter: only include items matching these keywords */
  keywords?: string[];
}

const FEEDS: FeedConfig[] = [
  // ── Job Boards ──────────────────────────────────────────────────────────
  {
    name: "RemoteOK",
    url: "https://remoteok.com/remote-jobs.rss",
    category: "Job",
    tags: ["remote", "tech"],
    platform: "Other",
  },
  // NOTE: Hacker News "Who is Hiring" is intentionally excluded here.
  // The dedicated hackernews.ts adapter parses individual job comments
  // from the thread. Ingesting the megathread itself as a single RSS
  // item would duplicate and misclassify the content.
  {
    name: "AngelList/Wellfound Jobs",
    url: "https://wellfound.com/job_search.json",
    category: "Job",
    tags: ["startup", "wellfound"],
    platform: "Other",
  },

  // ── Hackathons & Competitions ────────────────────────────────────────────
  {
    name: "Devpost Hackathons",
    url: "https://devpost.com/hackathons.xml",
    category: "Hackathon",
    tags: ["hackathon", "devpost"],
    platform: "Devpost",
  },
  {
    name: "MLH Events",
    url: "https://mlh.io/feed.xml",
    category: "Hackathon",
    tags: ["hackathon", "mlh", "student"],
    platform: "Other",
  },

  // ── Fellowships & Scholarships ──────────────────────────────────────────
  {
    name: "GradCafe",
    url: "https://www.thegradcafe.com/feed/",
    category: "Scholarship",
    tags: ["academic", "graduate"],
    platform: "Other",
  },

  // ── Tech Communities ────────────────────────────────────────────────────
  {
    name: "GitHub Blog",
    url: "https://github.blog/feed/",
    category: "Fellowship",
    tags: ["open-source", "github"],
    platform: "GitHub",
    keywords: ["campus", "student", "intern", "fellow", "program", "internship", "hiring"],
  },
  {
    name: "DEV Community",
    url: "https://dev.to/feed",
    category: "Event",
    tags: ["community", "tech"],
    platform: "Other",
    keywords: ["hackathon", "internship", "fellowship", "opportunity", "hiring", "program"],
  },
  // NOTE: Hacker News is intentionally excluded from RSS.
  // The dedicated hackernews.ts adapter parses individual job comments
  // from the "Who is Hiring?" thread via the HN Algolia API.
  // A generic HN RSS feed (hnrss.org/best) would ingest the megathread
  // itself and general hiring posts that are not actionable opportunities.

  // ── Events ──────────────────────────────────────────────────────────────
  {
    name: "Meetup Tech",
    url: "https://www.meetup.com/find/?source=EVENTS&categoryId=546",
    category: "Event",
    tags: ["meetup", "tech", "community"],
    platform: "Other",
  },
  {
    name: "conference.dev",
    url: "https://confs.tech/feed",
    category: "Event",
    tags: ["conference", "tech"],
    platform: "Other",
  },

  // ── Startup & Incubator ─────────────────────────────────────────────────
  {
    name: "YCombinator Blog",
    url: "https://www.ycombinator.com/blog/feed/",
    category: "Fellowship",
    tags: ["startup", "yc"],
    platform: "YCombinator",
    keywords: ["hiring", "job", "intern", "program", "fellow", "founder"],
  },
  {
    name: "TechCrunch Startups",
    url: "https://techcrunch.com/category/startups/feed/",
    category: "Grant",
    tags: ["startup", "funding"],
    platform: "Other",
    keywords: ["funding", "grant", "accelerator", "program", "fellowship"],
  },

  // ── Google & Microsoft Programs ─────────────────────────────────────────
  {
    name: "Google Careers Blog",
    url: "https://careers.google.com/blog/feed/",
    category: "Job",
    tags: ["google", "careers"],
    platform: "Google",
  },
  {
    name: "Microsoft Careers",
    url: "https://careers.microsoft.com/blog/feed/",
    category: "Job",
    tags: ["microsoft", "careers"],
    platform: "Microsoft",
  },
];

export class RssFeedSource implements OpportunitySource {
  name = "RSS Feeds";
  platform = "Other" as const;

  async fetch(): Promise<RawOpportunity[]> {
    console.log("[RSS] Fetching opportunity feeds...");

    const parser = new Parser({
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OppyBot/1.0)",
      },
    });

    const results: RawOpportunity[] = [];
    const seen = new Set<string>();

    for (const feed of FEEDS) {
      try {
        const parsed = await parser.parseURL(feed.url);
        const items = (parsed.items || []).slice(0, 30);

        for (const item of items) {
          const title = (item.title || "").trim();
          if (!title || title.length < 3) continue;

          const url = item.link || item.guid || "";
          if (!url) continue;

          // Apply keyword filter if configured
          if (feed.keywords && feed.keywords.length > 0) {
            const content = `${title} ${(item.contentSnippet || item.content || "")}`.toLowerCase();
            const matches = feed.keywords.some((kw) => content.includes(kw.toLowerCase()));
            if (!matches) continue;
          }

          // Dedup by URL
          const urlKey = url.toLowerCase().split("?")[0];
          if (seen.has(urlKey)) continue;
          seen.add(urlKey);

          // Parse dates
          const pubDate = item.pubDate || item.isoDate;
          const eventDate = pubDate ? new Date(pubDate) : null;
          const validDate = eventDate && !isNaN(eventDate.getTime()) ? eventDate : null;

          // Extract description
          const description = (item.contentSnippet || item.content || "").replace(/<[^>]+>/g, "").substring(0, 2000);

          // ── Opportunity signal scoring ───────────────────────────────
          // Require strong evidence that this item is an actionable opportunity,
          // not merely editorial content that happens to mention opportunity words.
          const combined = `${title} ${description}`.toLowerCase();

          // Positive signals: evidence of a real, actionable opportunity
          let opportunityScore = 0;

          // Explicit application/registration action words
          const hasApplicationAction = /\b(apply|application|register|registration|submit|submitting|enroll|enrolment)\b/.test(combined);
          if (hasApplicationAction) opportunityScore += 2;

          // Application/registration URL patterns in the text
          const hasApplicationUrl = /(apply|register|signup|sign-up|application|apply\.now|register\.now|forms\.gle|typeform|airtable|lever\.co|greenhouse\.io|workday\.com|ashbyhq\.com)/i.test(description);
          if (hasApplicationUrl) opportunityScore += 2;

          // Deadline / closing date evidence
          const hasDeadline = /\b(deadline|closing date|due date|last date|apply by|submit by|expires?|ends? on|ends? at|applications? (close|close|due))\b/.test(combined);
          if (hasDeadline) opportunityScore += 2;

          // Explicit invitation to participate
          const hasInvitation = /\b(now accepting|we're hiring|we are hiring|open for|looking for|seeking|accepting applications|accepting candidates|join (us|our|the)|become a|opportunity for)\b/.test(combined);
          if (hasInvitation) opportunityScore += 1;

          // Program/position announcement with eligibility
          const hasEligibility = /\b(eligible|eligibility|requirements|qualifications|who can apply|who should apply|candidates?|applicants?)\b/.test(combined);
          if (hasEligibility) opportunityScore += 1;

          // Hiring-specific strong signals (not just the word "hiring" in a news article)
          const hasHiringAction = /\b(hiring|we're hiring|join our team|open positions?|job openings?|career|vacancy|vacancies)\b/.test(combined);
          if (hasHiringAction) opportunityScore += 1;

          // Negative signals: editorial / news / commentary / analysis
          let editorialPenalty = 0;

          // News reporting language
          if (/\b(report|reports|reported|according to|analysis|analyst|research|study shows|survey|data shows|findings|insights|trend|trends|landscape|ecosystem|roundup|recap|overview|digest|weekly|monthly|daily)\b/.test(combined)) {
            editorialPenalty += 2;
          }

          // Commentary / opinion / announcement that isn't an opportunity
          if (/\b(opinion|editorial|commentary|perspective|thoughts on|my take|i think|i believe|we think|in my experience|lessons? learned|reflections?)\b/.test(combined)) {
            editorialPenalty += 3;
          }

          // Funding announcement (reporting on someone else's funding, not offering a grant)
          if (/\b(raised|raises|funding round|series [a-z]|valuation|investor|venture capital|backed by|announced.*funding|funding.*announced)\b/.test(combined)) {
            editorialPenalty += 3;
          }

          // Tutorial / how-to / educational content
          if (/\b(tutorial|how to|how-to|guide|step by step|walkthrough|getting started|introduction to|beginner|101|explained|deep dive|behind the scenes)\b/.test(combined)) {
            editorialPenalty += 3;
          }

          // Personnel / company news
          if (/\b(promoted|appointed|hired|new (ceo|cto|cfo|vp|director|head|lead)|joins? as|leaves?|departure|personnel)\b/.test(combined)) {
            editorialPenalty += 3;
          }

          const netScore = opportunityScore - editorialPenalty;

          // For editorial/news feeds (those with keyword filters), require a
          // positive net score to avoid publishing news as opportunities.
          const isEditorialFeed = !!(feed.keywords && feed.keywords.length > 0);
          const MIN_SCORE = isEditorialFeed ? 2 : 0;

          if (netScore < MIN_SCORE) {
            // Skip — this item lacks sufficient evidence of being an actionable opportunity
            continue;
          }

          // Determine category from strong signals
          const isInternship = /\b(intern|internship|co-?op)\b/.test(combined) && hasApplicationAction;
          const isFellowship = /\b(fellow|fellowship|scholarship)\b/.test(combined) && (hasApplicationAction || hasDeadline);
          const isGrant = /\b(grant|grants|scholarship|funding opportunity|financial support|stipend|fellowship)\b/.test(combined) && (hasApplicationAction || hasDeadline);
          const isHackathon = /\b(hackathon|hack|competition|contest)\b/.test(combined) && hasInvitation;
          const isEvent = /\b(conference|meetup|workshop|webinar|summit)\b/.test(combined) && (hasApplicationAction || hasInvitation);
          const isHiring = hasHiringAction && !isInternship;

          // Only assign opportunity categories when strong signals support it;
          // otherwise fall back to the feed's declared category (which for
          // editorial feeds is now gated by the score check above).
          const category: Category = isInternship ? "Internship" :
            isFellowship ? "Fellowship" :
            isGrant ? "Grant" :
            isHackathon ? "Hackathon" :
            isEvent ? "Event" :
            isHiring ? "Job" :
            feed.category;

          results.push({
            title,
            organization: feed.name,
            category,
            location: "See posting",
            tags: feed.tags.slice(0, 5),
            description: description || title,
            applicationLink: url,
            deadline: null,
            deadlineKind: "unavailable",
            source: "RSS",
            sourceUrl: url,
            sourcePlatform: feed.platform as any,
            sourceId: `rss-${Buffer.from(urlKey).toString("base64url").substring(0, 40)}`,
            ...(validDate ? { firstSeenAt: validDate } : {}),
          });
        }

        console.log(`[RSS] ${feed.name}: ${items.length} items`);
        // Polite delay
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`[RSS] ${feed.name} failed:`, err);
      }
    }

    console.log(`[RSS] Total opportunities from feeds: ${results.length}`);
    return results;
  }
}
