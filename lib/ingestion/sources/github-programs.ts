import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * GitHub Programs Source Adapter
 *
 * Uses the official GitHub REST API (no auth needed for public searches)
 * to discover open source programs, fellowship opportunities, and
 * student-relevant repositories via issue/topic search.
 */
export class GitHubProgramsSource implements OpportunitySource {
  name = "GitHub Open Source Programs";
  platform = "GitHub" as const;

  private readonly SEARCH_QUERIES = [
    { q: "label:gsoc OR label:GSoC is:open", category: "Fellowship" as Category, tag: "Open Source" },
    { q: "label:hacktoberfest is:open", category: "Hackathon" as Category, tag: "Open Source" },
    { q: '"open source program" OR "open source fellowship" is:open', category: "Fellowship" as Category, tag: "Open Source" },
    { q: '"student developer" OR "student program" is:open label:"good first issue"', category: "Internship" as Category, tag: "Open Source" },
  ];

  async fetch(): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];
    const seen = new Set<string>(); // Dedup within this source

    for (const search of this.SEARCH_QUERIES) {
      try {
        const url = `https://api.github.com/search/issues?q=${encodeURIComponent(search.q)}&sort=created&order=desc&per_page=15`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "OPPY-Bot/1.0",
            "Accept": "application/vnd.github.v3+json",
          },
        });

        if (!response.ok) {
          console.warn(`[GitHub] Search returned ${response.status} for query: ${search.q}`);
          continue;
        }

        const data = await response.json();

        for (const item of data.items || []) {
          if (seen.has(item.html_url)) continue;
          seen.add(item.html_url);

          const title = item.title || "Untitled";
          const body = (item.body || "").substring(0, 2000);
          const repoUrl = item.repository_url || "";
          const repoParts = repoUrl.split("/");
          const org = repoParts[repoParts.length - 2] || "GitHub";
          const repo = repoParts[repoParts.length - 1] || "";

          opportunities.push({
            title: `${title} (${org}/${repo})`,
            organization: org,
            category: search.category,
            location: "Remote",
            tags: [search.tag],
            description: body || `Open source opportunity in ${org}/${repo}: ${title}`,
            applicationLink: item.html_url,
            deadline: null,
            deadlineKind: "unavailable",
            source: "GitHub",
            sourceUrl: item.html_url,
            sourcePlatform: "GitHub",
            sourceId: `gh-issue-${item.id}`,
          });
        }
      } catch (error) {
        console.error(`[GitHub] Error searching:`, error);
      }
    }

    console.log(`[GitHub] Fetched ${opportunities.length} programs.`);
    return opportunities;
  }
}
