import { DiscoveryCandidate, DiscoverySource } from "./contracts";
import { canonicalUrl } from "./normalize";

const QUERIES = [
  "student hackathon application", "open source mentorship program", "student fellowship application",
  "site:internshala.com internship student", "site:naukri.com internship graduate", "site:lu.ma hackathon workshop student",
];

export class BraveSearchDiscoverySource implements DiscoverySource {
  name = "Brave Search";
  async discover(): Promise<DiscoveryCandidate[]> {
    const key = process.env.BRAVE_API_KEY;
    if (!key) return [];
    const candidates: DiscoveryCandidate[] = [];
    for (const q of QUERIES) {
      try {
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`, { headers: { Accept: "application/json", "X-Subscription-Token": key }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) { console.warn(`[Discovery:Brave] ${response.status}`); continue; }
        const json = await response.json();
        for (const item of json.web?.results || []) {
          const url = canonicalUrl(item.url); if (!url) continue;
          const host = new URL(url).hostname.toLowerCase();
          const sourcePlatform = host.endsWith("internshala.com") ? "Internshala" : host.endsWith("naukri.com") ? "Naukri" : host.endsWith("lu.ma") ? "Lu.ma" : "Other";
          candidates.push({ title: item.title, organization: host, url, sourcePlatform, sourceId: `brave-${Buffer.from(url).toString("base64url")}`, discoveredFrom: "Brave Search", trustTier: sourcePlatform === "Other" ? "unknown" : "platform", candidateType: sourcePlatform === "Other" ? "informational" : "opportunity", description: item.description || "", deadline: null, deadlineKind: "unavailable", evidence: [{ url, title: item.title, excerpt: item.description || "", fetchedAt: new Date(), provider: "Brave Search" }] });
        }
      } catch (error) { console.error("[Discovery:Brave] failed", error); }
    }
    return candidates;
  }
}
