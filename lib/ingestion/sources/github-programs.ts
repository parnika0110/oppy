import { RawOpportunity, OpportunitySource, Category } from "@/types/opportunity";

/**
 * GitHub Programs Source Adapter
 *
 * Uses the official GitHub REST API (no auth needed for public searches)
 * to discover open source programs, fellowship opportunities, and
 * student-relevant repositories via issue/topic search.
 *
 * Only ingests actual opportunities (programs, fellowships, internships,
 * hackathons). Filters out Good First Issues, bug fixes, feature requests,
 * workflow/CI changes, ZAP scans, documentation, and other non-opportunity
 * issue types.
 */
export class GitHubProgramsSource implements OpportunitySource {
  name = "GitHub Open Source Programs";
  platform = "GitHub" as const;

  /** Search queries targeting real programs, not generic issues. */
  private readonly SEARCH_QUERIES = [
    { q: "label:gsoc OR label:GSoC is:open", category: "Fellowship" as Category, tag: "Open Source" },
    { q: "label:hacktoberfest is:open is:issue", category: "Hackathon" as Category, tag: "Open Source" },
    { q: '"open source program" OR "open source fellowship" is:open is:issue', category: "Fellowship" as Category, tag: "Open Source" },
    { q: '"campus expert" OR "student ambassador" is:open is:issue', category: "Fellowship" as Category, tag: "Open Source" },
  ];

  /** Issue labels that indicate non-opportunity content. */
  private static readonly REJECTED_LABELS = new Set([
    "good first issue",
    "good-first-issue",
    "beginner",
    "help wanted",
    "bug",
    "enhancement",
    "documentation",
    "ci",
    "dependencies",
    "security",
    "duplicate",
    "invalid",
    "wontfix",
    "question",
    "discussion",
  ]);

  /** Title patterns that indicate non-opportunity content (PRs, CI, scans, etc.). */
  private static readonly REJECTED_TITLE_PATTERNS = [
    // Commit conventional prefixes
    /^\[good first issue\]/i,
    /^good first issue/i,
    /^fix[:\s(]/i,
    /^feat[(:(]/i,
    /^\[feat[:(]/i,
    /^\[feature[:(]/i,
    /^\[enhancement[:(]/i,
    /^perf[(:(]/i,
    /^docs[:\s]/i,
    /^chore[:\s]/i,
    /^refactor[:\s]/i,
    /^test[:\s]/i,
    /^ci[:\s]/i,
    // Security scans
    /^zap\s/i,
    /baseline scan/i,
    /dast/i,
    // PR/CI/workflow keywords
    /pull request/i,
    /^automated /i,
    /workflow/i,
    /dependency/i,
    /dependabot/i,
    /renovate/i,
    /bump /i,
    /release /i,
    /build /i,
    /hardening/i,
    /credential leak/i,
    /gate merge/i,
    // Issue types that aren't opportunities
    /^category request/i,
    /improve readme/i,
    /improve project documentation/i,
    /portfolio archaeology/i,
    /adapter$/i,
    /nameerror/i,
    /does not parse/i,
    /maximum value limit/i,
    /normalize.*paths/i,
    /landing page for/i,
    /windows \d+ support/i,
    /prepare to enroll/i,
    /usability test/i,
    /^guidelines$/i,
    /synthetic data generator/i,
    /load testing suite/i,
    /lazy load/i,
    /offline.*logging/i,
    /sponsor layout/i,
    /line continuation/i,
    /account linking/i,
    /semicolon/i,
  ];

  /**
   * Determine whether a GitHub issue represents an actual opportunity
   * (program, fellowship, internship, hackathon) rather than a code
   * contribution task, CI change, or security scan.
   */
  static isOpportunity(item: { title?: string; labels?: Array<{ name?: string }> }): boolean {
    const title = (item.title || "").toLowerCase();
    const labels = (item.labels || []).map((l) => (l.name || "").toLowerCase());

    // Reject if any label is a non-opportunity type
    for (const label of labels) {
      if (this.REJECTED_LABELS.has(label)) return false;
    }

    // Reject if title matches non-opportunity patterns
    for (const pattern of this.REJECTED_TITLE_PATTERNS) {
      if (pattern.test(item.title || "")) return false;
    }

    return true;
  }

  async fetch(): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];
    const seen = new Set<string>(); // Dedup within this source
    let rejectedCount = 0;

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

          // Filter out non-opportunity issues
          if (!GitHubProgramsSource.isOpportunity(item)) {
            rejectedCount++;
            continue;
          }

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

    console.log(`[GitHub] Fetched ${opportunities.length} programs (rejected ${rejectedCount} non-opportunities).`);
    return opportunities;
  }
}
