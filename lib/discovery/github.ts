import { DiscoveryCandidate, DiscoverySource } from "./contracts";

export class GitHubDiscoverySource implements DiscoverySource {
  name = "GitHub discovery signals";
  private readonly queries = ["label:good-first-issue is:open", "label:help-wanted is:open", "label:hacktoberfest is:open"];

  async discover(): Promise<DiscoveryCandidate[]> {
    const candidates: DiscoveryCandidate[] = [];
    for (const q of this.queries) {
      try {
        const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=20`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "OPPY-Discovery" }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) { console.warn(`[Discovery:GitHub] ${response.status}`); continue; }
        const json = await response.json();
        for (const item of json.items || []) {
          const repo = String(item.repository_url || "").split("/").slice(-1)[0] || "GitHub";
          candidates.push({
            title: String(item.title || "Untitled"), organization: repo, url: item.html_url,
            sourcePlatform: "GitHub", sourceId: `github-signal-${item.id}`, discoveredFrom: "GitHub Search API",
            trustTier: "platform", candidateType: item.pull_request ? "github_pr" : "github_issue",
            description: String(item.body || "").slice(0, 4000), deadline: null, deadlineKind: "unavailable",
            evidence: [{ url: item.html_url, title: item.title, excerpt: String(item.body || "").slice(0, 500), fetchedAt: new Date(), provider: "GitHub Search API" }],
          });
        }
      } catch (error) { console.error("[Discovery:GitHub] failed", error); }
    }
    return candidates;
  }
}
