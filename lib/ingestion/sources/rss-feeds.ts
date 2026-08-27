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
  {
    name: "Hacker News Who's Hiring",
    url: "https://hnrss.org/newest?q=Who+is+hiring&points=100",
    category: "Job",
    tags: ["hacker-news", "startup"],
    platform: "Other",
  },
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
  {
    name: "Hacker News Best",
    url: "https://hnrss.org/best?q=hiring+OR+internship+OR+fellowship+OR+hackathon+OR+opportunity",
    category: "Job",
    tags: ["hacker-news"],
    platform: "Other",
  },

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

          // Check if it looks like an opportunity
          const combined = `${title} ${description}`.toLowerCase();
          const isHiring = combined.includes("hiring") || combined.includes("looking for") || combined.includes("we're seeking");
          const isEvent = combined.includes("event") || combined.includes("conference") || combined.includes("meetup") || combined.includes("workshop");
          const isInternship = combined.includes("intern") || combined.includes("internship");
          const isFellowship = combined.includes("fellow") || combined.includes("fellowship") || combined.includes("scholarship");

          // Skip pure blog posts that aren't about opportunities
          if (!isHiring && !isEvent && !isInternship && !isFellowship &&
              feed.keywords && feed.keywords.length > 0) {
            // If keyword filter matched but it's not clearly an opportunity, still include
          }

          const category: Category = isInternship ? "Internship" :
            isFellowship ? "Fellowship" :
            isEvent ? "Event" :
            isHiring ? "Job" : feed.category;

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
