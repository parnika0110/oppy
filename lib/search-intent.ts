/**
 * Deterministic natural-language query parser for OPPY discovery searches.
 *
 * Turns phrases such as "AI internships in Bengaluru" into structured
 * search intents (category / interest / remote / location / experience)
 * plus leftover keyword terms, so the quick-search and browse search boxes
 * behave consistently with the structured filter UI and the AI wizard.
 *
 * This mirrors the extraction rules the AI wizard already produced
 * (see lib/sarvam/mock.ts) but runs synchronously with no network or API.
 */

export interface SearchIntent {
  categories?: string[];
  interests?: string[];
  remote?: boolean;
  location?: string;
  experience?: string;
  /** Meaningful leftover terms after structured signals were removed. */
  keywords: string[];
}

// ── Category detection (order matters — first match wins, as in the wizard) ─

const CATEGORY_RULES: Array<{ category: string; pattern: RegExp; words: string[] }> = [
  { category: "Internship", pattern: /\b(intern|internship)s?\b/i, words: ["intern", "interns", "internship", "internships"] },
  { category: "Hackathon", pattern: /\b(hackathon|hack)s?\b/i, words: ["hackathon", "hackathons", "hack", "hacks"] },
  { category: "Job", pattern: /\b(jobs?|hiring)\b/i, words: ["job", "jobs", "hiring"] },
  { category: "Fellowship", pattern: /\bfellowships?\b/i, words: ["fellowship", "fellowships"] },
  { category: "Event", pattern: /\bevents?\b/i, words: ["event", "events"] },
  { category: "Grant", pattern: /\bgrant\b|\bgrants\b/i, words: ["grant", "grants"] },
  { category: "Scholarship", pattern: /\bscholarships?\b/i, words: ["scholarship", "scholarships"] },
];

// ── Interest detection — specific domains first, then generic software ────

interface InterestRule {
  interest: string;
  pattern: RegExp;
}

const INTEREST_RULES: InterestRule[] = [
  { interest: "Cybersecurity", pattern: /\b(cybersecurity|cyber security|infosec|pentest|penetration|vulnerability)\b/i },
  { interest: "AI / ML", pattern: /\b(machine learning|artificial intelligence|deep learning|nlp|llm)\b/i },
  { interest: "Data Science", pattern: /\bdata science\b/i },
  { interest: "Web Development", pattern: /\b(frontend|front-end|react|vue|angular)\b/i },
  { interest: "Software Engineering", pattern: /\b(backend|back-end|server)\b/i },
  { interest: "Design", pattern: /\b(design|ux|ui|figma)\b/i },
  { interest: "Open Source", pattern: /\b(open source|opensource|foss)\b/i },
  { interest: "Product Management", pattern: /\b(product management|product manager)\b/i },
];

// "AI" alone only counts when it is a standalone token (not "email", "said", …)
const AI_ALONE = /\bai\b/i;
const AI_ALONE_CONTEXT = /\b(ai\s|ai\/|\bai$)/i;
const SOFTWARE_GENERIC = /\b(software|developer|engineer|coding)\b/i;

// ── Location detection — cities first, then countries (mirrors the wizard) ─

const LOCATION_RULES: Array<{ location: string; pattern: RegExp; words: string[] }> = [
  { location: "Bengaluru", pattern: /\b(bengaluru|bangalore)\b/i, words: ["bengaluru", "bangalore"] },
  { location: "Mumbai", pattern: /\b(mumbai|bombay)\b/i, words: ["mumbai", "bombay"] },
  { location: "Delhi", pattern: /\b(new delhi|delhi)\b/i, words: ["delhi"] },
  { location: "Hyderabad", pattern: /\bhyderabad\b/i, words: ["hyderabad"] },
  { location: "Chennai", pattern: /\bchennai\b/i, words: ["chennai"] },
  { location: "Pune", pattern: /\bpune\b/i, words: ["pune"] },
  { location: "Kolkata", pattern: /\bkolkata\b/i, words: ["kolkata"] },
  { location: "Ahmedabad", pattern: /\bahmedabad\b/i, words: ["ahmedabad"] },
  { location: "Jaipur", pattern: /\bjaipur\b/i, words: ["jaipur"] },
  { location: "India", pattern: /\b(india|indian)\b/i, words: ["india", "indian"] },
  { location: "United States", pattern: /\b(us|usa|united states|america|american)\b/i, words: ["us", "usa", "united", "states", "america", "american"] },
  { location: "United Kingdom", pattern: /\b(uk|united kingdom|britain|british|england)\b/i, words: ["uk", "united", "kingdom", "britain", "british", "england"] },
  { location: "Europe", pattern: /\beurope|european\b/i, words: ["europe", "european"] },
  { location: "Canada", pattern: /\b(canada|canadian)\b/i, words: ["canada", "canadian"] },
  { location: "Germany", pattern: /\b(germany|german)\b/i, words: ["germany", "german"] },
  { location: "Australia", pattern: /\b(australia|australian)\b/i, words: ["australia", "australian"] },
  { location: "Singapore", pattern: /\bsingapore\b/i, words: ["singapore"] },
  { location: "Global", pattern: /\b(global|worldwide|international)\b/i, words: ["global", "worldwide", "international"] },
];

// Hindi location aliases (wizard parity)
const HINDI_RULES: Array<{ location: string; pattern: RegExp }> = [
  { location: "India", pattern: /भारत|bharat/i },
  { location: "Bengaluru", pattern: /बेंगलुरु|बैंगलोर/i },
  { location: "Mumbai", pattern: /मुंबई/i },
  { location: "Delhi", pattern: /दिल्ली/i },
];

// ── Remote / experience / stopwords ──────────────────────────────────────

const REMOTE_RULES: Array<{ words: string[]; pattern: RegExp }> = [
  { words: ["remote", "remotely"], pattern: /\b(remote|remotely|work from home|wfh|online)\b/i },
  { words: ["work", "from", "home", "wfh", "online"], pattern: /\b(work from home|wfh|online)\b/i },
];

const EXPERIENCE_RULES: Array<{ experience: string; pattern: RegExp; words: string[] }> = [
  { experience: "Student", pattern: /\b(student|undergraduate|campus)s?\b/i, words: ["student", "students", "undergraduate", "undergraduates", "campus"] },
  { experience: "Recent Graduate", pattern: /\b(recent|fresh) graduates?\b/i, words: ["recent", "fresh", "graduate", "graduates"] },
  { experience: "Working Professional", pattern: /\b(working professional|experienced)\b/i, words: ["working", "professional", "professionals", "experienced"] },
];

const STOPWORDS = new Set([
  "a", "an", "the", "in", "for", "of", "at", "on", "near", "to", "from", "and", "or", "with",
  "by", "me", "my", "i", "we", "want", "wanted", "looking", "look", "find", "finding", "found",
  "show", "showing", "please", "some", "good", "best", "great", "top", "new", "get", "am", "is",
  "are", "do", "does", "that", "this", "these", "those", "have", "has", "about", "any", "all",
  "other", "such", "mein", "chahiye", "mujhe", "karke", "ke", "ka", "ki",
  // generic nouns that carry no search signal and only hurt token AND matching
  "opportunity", "opportunities", "role", "roles", "position", "positions", "opening", "openings", "listing", "listings",
]);

const ASCII_TOKEN = /^[a-z0-9][a-z0-9+&./-]*$/i;

function tokenize(q: string): string[] {
  return q.split(/[\s,]+/).filter(Boolean);
}

function wordPhraseIn(lower: string, phrase: string): boolean {
  // Whole-word containment for the phrase (escape regex specials)
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
}

/**
 * Parse a free-text query into structured search signals + leftover keywords.
 */
export function parseSearchQuery(q: string): SearchIntent {
  const original = q.trim();
  const lower = original.toLowerCase();
  const tokens = tokenize(original);

  const intent: SearchIntent = { keywords: [] };

  // ── Category (first match wins) ──────────────────────────────────
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(lower)) {
      intent.categories = [rule.category];
      break;
    }
  }

  // ── Interests ────────────────────────────────────────────────────
  const interests: string[] = [];
  for (const rule of INTEREST_RULES) {
    if (rule.pattern.test(lower)) interests.push(rule.interest);
  }
  if (AI_ALONE.test(lower) && AI_ALONE_CONTEXT.test(lower)) interests.push("AI / ML");
  if (SOFTWARE_GENERIC.test(lower) && interests.length === 0) interests.push("Software Engineering");
  if (interests.length > 0) intent.interests = [...new Set(interests)];

  // ── Remote ───────────────────────────────────────────────────────
  if (REMOTE_RULES[0].pattern.test(lower)) intent.remote = true;

  // ── Location (cities before countries) ───────────────────────────
  for (const rule of LOCATION_RULES) {
    if (rule.pattern.test(lower)) {
      intent.location = rule.location;
      break;
    }
  }
  if (!intent.location) {
    for (const rule of HINDI_RULES) {
      if (rule.pattern.test(lower)) {
        intent.location = rule.location;
        break;
      }
    }
  }

  // ── Experience ───────────────────────────────────────────────────
  for (const rule of EXPERIENCE_RULES) {
    if (rule.pattern.test(lower)) {
      intent.experience = rule.experience;
      break;
    }
  }

  // ── Leftover keywords: drop every token that contributed to a signal ──
  const drop = new Set<string>(STOPWORDS);
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(lower)) {
      for (const w of rule.words) drop.add(w);
      break;
    }
  }
  for (const rule of REMOTE_RULES) {
    if (rule.pattern.test(lower)) {
      for (const w of rule.words) drop.add(w);
      break;
    }
  }
  for (const rule of EXPERIENCE_RULES) {
    if (rule.pattern.test(lower)) {
      for (const w of rule.words) drop.add(w);
      break;
    }
  }
  for (const rule of LOCATION_RULES) {
    if (rule.pattern.test(lower)) {
      for (const w of rule.words) {
        if (wordPhraseIn(lower, w)) drop.add(w);
      }
      break;
    }
  }
  for (const rule of HINDI_RULES) {
    if (!intent.location && rule.pattern.test(lower)) {
      break;
    }
  }

  const seen = new Set<string>();
  for (const t of tokens) {
    const tl = t.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (!tl || tl.length < 2 || drop.has(tl) || seen.has(tl)) continue;
    if (!ASCII_TOKEN.test(tl)) continue;
    seen.add(tl);
    intent.keywords.push(tl);
  }

  return intent;
}

/** True when the parser extracted at least one structured signal. */
export function hasSearchSignals(intent: SearchIntent): boolean {
  return Boolean(
    intent.categories?.length ||
    intent.interests?.length ||
    intent.remote ||
    intent.location ||
    intent.experience
  );
}

/**
 * Merge a parsed NL intent into existing URL params, producing the canonical
 * search URL query — or null when nothing needs to change.
 *
 * Rules:
 * - Starts from the EXISTING params, so explicitly selected structured filters
 *   (remote=true, category=Job, location=Delhi, …) are preserved.
 * - The parsed intent fills in only fields the user has not already pinned
 *   down (setIfAbsent), then rewrites q to the leftover keywords.
 * - Because it runs even when structured filters are already present, an
 *   unrelated old filter (e.g. remote=true from a previous search) can never
 *   suppress natural-language interpretation of a new keyword query.
 */
export function canonicalizeSearchParams(
  params: Record<string, string | undefined>,
  intent: SearchIntent
): URLSearchParams | null {
  // Plain keyword queries (no structured signals) are left untouched — they
  // remain backward-compatible literal text searches.
  if (!hasSearchSignals(intent)) return null;
  const out = new URLSearchParams();
  let changed = false;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) out.set(key, value);
  }
  const setIfAbsent = (key: string, value?: string) => {
    if (value && !out.has(key)) {
      out.set(key, value);
      changed = true;
    }
  };
  setIfAbsent("categories", intent.categories?.length ? intent.categories.join(",") : undefined);
  setIfAbsent("interests", intent.interests?.length ? intent.interests.join(",") : undefined);
  setIfAbsent("location", intent.location);
  if (intent.remote) setIfAbsent("remote", "true");
  setIfAbsent("experience", intent.experience);
  const keywords = intent.keywords.join(" ");
  if (keywords) {
    if (out.get("q") !== keywords) {
      out.set("q", keywords);
      changed = true;
    }
  } else if (out.has("q")) {
    out.delete("q");
    changed = true;
  }
  if (!changed) return null;
  out.delete("page");
  return out;
}