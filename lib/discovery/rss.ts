import Parser from "rss-parser";
import { DiscoveryCandidate, DiscoverySource } from "./contracts";
import { canonicalUrl } from "./normalize";

const FEEDS = [
  { name: "GitHub Blog", url: "https://github.blog/feed/", platform: "GitHub" as const },
  { name: "DEV Community", url: "https://dev.to/feed", platform: "Other" as const },
];

export class RssDiscoverySource implements DiscoverySource {
  name = "RSS announcements";

  async discover(): Promise<DiscoveryCandidate[]> {
    const parser = new Parser();
    const candidates: DiscoveryCandidate[] = [];
    for (const feed of FEEDS) {
      try {
        const result = await parser.parseURL(feed.url);
        for (const item of (result.items || []).slice(0, 25)) {
          const url = canonicalUrl(item.link || "");
          if (!url || !item.title) continue;
          candidates.push({
            title: item.title.trim(), organization: feed.name, url, sourcePlatform: feed.platform,
            sourceId: `rss-${Buffer.from(url).toString("base64url")}`, discoveredFrom: feed.name,
            trustTier: feed.name === "GitHub Blog" ? "official" : "community", candidateType: "informational",
            description: item.contentSnippet || item.content || "", deadline: null, deadlineKind: "unavailable",
            evidence: [{ url, title: item.title, excerpt: item.contentSnippet || "", fetchedAt: new Date(), provider: feed.name }],
          });
        }
      } catch (error) { console.error(`[Discovery:RSS] ${feed.name} failed`, error); }
    }
    return candidates;
  }
}
