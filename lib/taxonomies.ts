/**
 * Canonical taxonomy definitions for OPPY controlled inputs.
 *
 * Every selectable value has:
 *   - id: slug used in storage/scoring (e.g. "python", "devops")
 *   - label: human-readable display (e.g. "Python", "DevOps")
 *   - aliases: legacy/variant strings that map to this canonical entry
 *   - popular: whether to show as a popular suggestion
 */

export interface TaxonomyEntry {
  id: string;
  label: string;
  aliases: string[];
  popular?: boolean;
}

// ── Skills ────────────────────────────────────────────────────────────────

export const SKILL_TAXONOMY: TaxonomyEntry[] = [
  { id: "python", label: "Python", aliases: ["pyhton", "pyton", "pythonn", "py"], popular: true },
  { id: "javascript", label: "JavaScript", aliases: ["javscript", "javasript", "javascrpt", "js"], popular: true },
  { id: "typescript", label: "TypeScript", aliases: ["typescrpt", "ts"], popular: true },
  { id: "react", label: "React", aliases: ["reactjs", "react.js"], popular: true },
  { id: "nodejs", label: "Node.js", aliases: ["node", "nodejs"], popular: true },
  { id: "java", label: "Java", aliases: [], popular: true },
  { id: "c-plus-plus", label: "C++", aliases: ["cpluspus", "cplusu", "cpp"], popular: false },
  { id: "c-sharp", label: "C#", aliases: ["cshrp", "csharp", "c#"], popular: false },
  { id: "rust", label: "Rust", aliases: [], popular: false },
  { id: "go", label: "Go", aliases: ["golang"], popular: false },
  { id: "swift", label: "Swift", aliases: [], popular: false },
  { id: "kotlin", label: "Kotlin", aliases: [], popular: false },
  { id: "sql", label: "SQL", aliases: [], popular: true },
  { id: "html-css", label: "HTML/CSS", aliases: ["html", "css"], popular: false },
  { id: "machine-learning", label: "Machine Learning", aliases: ["machne learning", "machine learing", "ml"], popular: true },
  { id: "deep-learning", label: "Deep Learning", aliases: ["deep learing", "dl"], popular: false },
  { id: "data-science", label: "Data Science", aliases: ["data scence", "data scinece", "ds"], popular: true },
  { id: "data-engineering", label: "Data Engineering", aliases: ["data enginering", "data enginerring", "de"], popular: true },
  { id: "web-development", label: "Web Development", aliases: ["web developement", "web develoment", "web dev"], popular: false },
  { id: "frontend-development", label: "Frontend Development", aliases: ["frontend", "front-end", "frontend dev", "client-side", "ui development"], popular: true },
  { id: "backend-development", label: "Backend Development", aliases: ["backend", "back-end", "backend dev", "server-side", "api development", "api"], popular: true },
  { id: "full-stack-development", label: "Full Stack Development", aliases: ["full stack", "full-stack", "fullstack", "full stack development"], popular: true },
  { id: "mobile-development", label: "Mobile Development", aliases: ["mobile dev", "mobile devlopment", "ios", "android", "mobile app development", "cross-platform"], popular: true },
  { id: "devops", label: "DevOps", aliases: ["dev ops", "devop", "devops engineering", "infrastructure engineering"], popular: true },
  { id: "cloud", label: "Cloud", aliases: ["aws", "gcp", "azure", "cloud computing", "cloud engineering", "cloud infrastructure"], popular: false },
  { id: "kubernetes", label: "Kubernetes", aliases: ["kubernets", "kuberentes", "k8s"], popular: false },
  { id: "docker", label: "Docker", aliases: ["dockers"], popular: false },
  { id: "terraform", label: "Terraform", aliases: [], popular: false },
  { id: "git", label: "Git", aliases: ["github"], popular: false },
  { id: "figma", label: "Figma", aliases: [], popular: false },
  { id: "ui-ux", label: "UI/UX Design", aliases: ["ui/ux", "ux/ui", "ui ux design", "visual design", "interaction design"], popular: true },
  { id: "product-management", label: "Product Management", aliases: ["producr management", "product managment", "pm"], popular: false },
  { id: "cybersecurity", label: "Cybersecurity", aliases: ["cybersecuirty", "cyber secuirty", "cyber security", "infosec", "penetration testing", "security engineering"], popular: false },
  { id: "blockchain", label: "Blockchain", aliases: ["web3", "crypto", "defi", "smart contracts"], popular: false },
  { id: "qa-testing", label: "QA / Testing", aliases: ["qa", "quality assurance", "testing", "software testing", "test automation", "sdet", "quality engineering", "manual testing", "automated testing"], popular: true },
  { id: "embedded-systems", label: "Embedded Systems", aliases: ["embedded", "embedded systems", "firmware", "iot", "internet of things", "embedded software", "embedded engineering"], popular: false },
  { id: "data-annotation", label: "Data Annotation", aliases: ["data annotation", "data labeling", "annotation", "labeling", "data tagging"], popular: false },
  { id: "technical-writing", label: "Technical Writing", aliases: ["tech writing", "documentation", "technical documentation", "developer docs"], popular: false },
  { id: "game-development", label: "Game Development", aliases: ["game dev", "gamedev", "game design", "unity", "unreal"], popular: false },
  { id: "graphql", label: "GraphQL", aliases: ["graph ql"], popular: false },
  { id: "tensorflow", label: "TensorFlow", aliases: ["tensoflow"], popular: false },
  { id: "pytorch", label: "PyTorch", aliases: ["pytorh"], popular: false },
  { id: "nextjs", label: "Next.js", aliases: ["nextjs", "next js"], popular: false },
  { id: "vuejs", label: "Vue.js", aliases: ["vuejs", "vue js"], popular: false },
  { id: "angular", label: "Angular", aliases: ["angualr", "anguler"], popular: false },
  { id: "flutter", label: "Flutter", aliases: [], popular: false },
  { id: "react-native", label: "React Native", aliases: [], popular: false },
  { id: "svelte", label: "Svelte", aliases: [], popular: false },
  { id: "django", label: "Django", aliases: [], popular: false },
  { id: "flask", label: "Flask", aliases: [], popular: false },
  { id: "spring", label: "Spring", aliases: ["spring boot"], popular: false },
  { id: "postgresql", label: "PostgreSQL", aliases: ["postgres"], popular: false },
  { id: "mongodb", label: "MongoDB", aliases: [], popular: false },
  { id: "redis", label: "Redis", aliases: [], popular: false },
  { id: "elasticsearch", label: "Elasticsearch", aliases: ["elastic search"], popular: false },
  { id: "airflow", label: "Airflow", aliases: [], popular: false },
  { id: "spark", label: "Spark", aliases: ["apache spark"], popular: false },
  { id: "kafka", label: "Kafka", aliases: [], popular: false },
  { id: "ci-cd", label: "CI/CD", aliases: ["cicd", "ci/cd"], popular: false },
  { id: "linux", label: "Linux", aliases: [], popular: false },
  { id: "bash", label: "Bash/Shell", aliases: ["shell", "bash scripting"], popular: false },
  { id: "nlp", label: "NLP", aliases: ["natural language processing"], popular: false },
  { id: "computer-vision", label: "Computer Vision", aliases: ["cv", "computer vision"], popular: false },
  { id: "statistics", label: "Statistics", aliases: ["stats"], popular: false },
  { id: "pandas", label: "Pandas", aliases: [], popular: false },
  { id: "excel", label: "Excel", aliases: ["microsoft excel"], popular: false },
  { id: "power-bi", label: "Power BI", aliases: ["powerbi"], popular: false },
  { id: "tableau", label: "Tableau", aliases: [], popular: false },
  { id: "dsa", label: "Data Structures & Algorithms", aliases: ["dsa", "data structures", "algorithms", "algorithm"], popular: false },
  { id: "oop", label: "Object-Oriented Programming", aliases: ["oop", "object oriented"], popular: false },
  { id: "dbms", label: "DBMS", aliases: ["database management"], popular: false },
  { id: "problem-solving", label: "Problem Solving", aliases: ["problem solving"], popular: false },
  { id: "communication", label: "Communication", aliases: [], popular: false },
  { id: "teamwork", label: "Teamwork", aliases: ["team work", "team collaboration"], popular: false },
  { id: "leadership", label: "Leadership", aliases: [], popular: false },
];

// ── Interests ─────────────────────────────────────────────────────────────
// These align with INTEREST_TAXONOMY in lib/interests.ts but add canonical IDs

export const INTEREST_TAXONOMY_ENTRIES: TaxonomyEntry[] = [
  { id: "ai-ml", label: "AI / ML", aliases: ["ai", "ml", "artificial intelligence", "machine learning", "genai", "generative ai"], popular: true },
  { id: "web-development", label: "Web Development", aliases: ["web dev", "webdev"], popular: true },
  { id: "software-engineering", label: "Software Engineering", aliases: ["swe", "software dev", "software developer", "backend", "back-end", "frontend", "front-end", "full stack", "full-stack", "fullstack"], popular: true },
  { id: "open-source", label: "Open Source", aliases: ["oss", "foss", "open source"], popular: true },
  { id: "data-engineering", label: "Data Engineering", aliases: ["de", "data eng"], popular: true },
  { id: "data-science", label: "Data Science", aliases: ["ds", "data analytics", "data analysis"], popular: true },
  { id: "design", label: "Design", aliases: ["ui design", "ux design", "ui/ux", "graphic design", "visual design", "interaction design"], popular: false },
  { id: "research", label: "Research", aliases: ["academic research", "academic"], popular: false },
  { id: "cybersecurity", label: "Cybersecurity", aliases: ["cyber security", "infosec", "security"], popular: false },
  { id: "product-management", label: "Product Management", aliases: ["pm", "product"], popular: false },
  { id: "cloud", label: "Cloud", aliases: ["cloud computing", "infrastructure", "cloud infrastructure"], popular: false },
  { id: "startups", label: "Startups", aliases: ["startup", "founder", "entrepreneurship"], popular: true },
  { id: "mobile", label: "Mobile", aliases: ["mobile dev", "mobile development", "ios", "android", "mobile app development", "cross-platform"], popular: false },
  { id: "devops", label: "DevOps", aliases: ["dev ops", "devop", "sre", "site reliability"], popular: false },
  { id: "game-dev", label: "Game Dev", aliases: ["game development", "gamedev", "game design"], popular: false },
  { id: "fintech", label: "Fintech", aliases: ["finance", "financial tech"], popular: false },
  { id: "healthcare", label: "Healthcare", aliases: ["health tech", "medtech"], popular: false },
  { id: "climate", label: "Climate", aliases: ["climate tech", "cleantech", "sustainability", "environment"], popular: false },
  { id: "robotics", label: "Robotics", aliases: ["robot"], popular: false },
  { id: "blockchain", label: "Blockchain", aliases: ["web3", "crypto", "defi"], popular: false },
  { id: "devrel", label: "Developer Relations", aliases: ["devrel", "developer advocacy", "tech writing"], popular: false },

  // ── Career-area interests (what kind of work a user wants to do) ──────
  { id: "backend-development", label: "Backend Development", aliases: ["backend", "back-end", "backend dev", "server-side", "api development", "api", "server-side development"], popular: true },
  { id: "frontend-development", label: "Frontend Development", aliases: ["frontend", "front-end", "frontend dev", "client-side", "ui development", "client-side development"], popular: true },
  { id: "full-stack-development", label: "Full Stack Development", aliases: ["full stack", "full-stack", "fullstack", "full stack development", "full-stack development"], popular: true },
  { id: "quality-assurance", label: "Quality Assurance", aliases: ["qa", "quality assurance", "testing", "software testing", "test automation", "sdet", "quality engineering"], popular: true },
  { id: "data-annotation", label: "Data Annotation", aliases: ["data annotation", "data labeling", "annotation", "labeling", "data tagging"], popular: false },
  { id: "embedded-systems", label: "Embedded Systems", aliases: ["embedded", "embedded systems", "firmware", "iot", "internet of things", "embedded software", "embedded engineering"], popular: false },
  { id: "technical-writing", label: "Technical Writing", aliases: ["tech writing", "documentation", "technical documentation", "developer docs"], popular: false },
  { id: "consulting", label: "Consulting", aliases: ["consultant", "management consulting", "tech consulting", "advisory"], popular: false },
  { id: "data-analytics", label: "Data Analytics", aliases: ["data analytics", "analytics", "business analytics", "business intelligence", "bi"], popular: true },
];

// ── Locations ─────────────────────────────────────────────────────────────

export const LOCATION_TAXONOMY: TaxonomyEntry[] = [
  // India
  { id: "bengaluru", label: "Bengaluru", aliases: ["bangalore", "bengaluru, karnataka", "bangalore, karnataka"], popular: true },
  { id: "mumbai", label: "Mumbai", aliases: ["bombay"], popular: true },
  { id: "delhi", label: "Delhi", aliases: ["new delhi", "ncr"], popular: true },
  { id: "hyderabad", label: "Hyderabad", aliases: [], popular: false },
  { id: "chennai", label: "Chennai", aliases: ["madras"], popular: false },
  { id: "pune", label: "Pune", aliases: [], popular: false },
  { id: "kolkata", label: "Kolkata", aliases: ["calcutta"], popular: false },
  { id: "ahmedabad", label: "Ahmedabad", aliases: [], popular: false },
  { id: "jaipur", label: "Jaipur", aliases: [], popular: false },
  { id: "india", label: "India", aliases: ["indian", "bharat"], popular: true },

  // US
  { id: "san-francisco", label: "San Francisco", aliases: ["sf", "bay area"], popular: true },
  { id: "new-york", label: "New York", aliases: ["nyc", "new york city"], popular: true },
  { id: "seattle", label: "Seattle", aliases: [], popular: false },
  { id: "los-angeles", label: "Los Angeles", aliases: ["la"], popular: false },
  { id: "austin", label: "Austin", aliases: [], popular: false },
  { id: "boston", label: "Boston", aliases: [], popular: false },
  { id: "chicago", label: "Chicago", aliases: [], popular: false },
  { id: "united-states", label: "United States", aliases: ["usa", "us", "america"], popular: true },

  // Europe
  { id: "london", label: "London", aliases: [], popular: true },
  { id: "berlin", label: "Berlin", aliases: [], popular: false },
  { id: "paris", label: "Paris", aliases: [], popular: true },
  { id: "amsterdam", label: "Amsterdam", aliases: [], popular: false },
  { id: "munich", label: "Munich", aliases: [], popular: false },
  { id: "zurich", label: "Zurich", aliases: [], popular: false },
  { id: "united-kingdom", label: "United Kingdom", aliases: ["uk", "britain"], popular: false },
  { id: "germany", label: "Germany", aliases: [], popular: false },
  { id: "france", label: "France", aliases: [], popular: false },

  // Asia-Pacific
  { id: "singapore", label: "Singapore", aliases: [], popular: true },
  { id: "tokyo", label: "Tokyo", aliases: [], popular: false },
  { id: "toronto", label: "Toronto", aliases: [], popular: true },
  { id: "canada", label: "Canada", aliases: ["canadian"], popular: true },
  { id: "australia", label: "Australia", aliases: ["australian", "sydney", "melbourne"], popular: false },

  // Special
  { id: "remote", label: "Remote", aliases: ["online", "work from home", "wfh", "remote work"], popular: true },
  { id: "global", label: "Global", aliases: ["worldwide", "international"], popular: true },
];

// ── Lookup helpers ────────────────────────────────────────────────────────

/** Build a case-insensitive alias → entry map for fast lookups. */
function buildAliasMap(entries: TaxonomyEntry[]): Map<string, TaxonomyEntry> {
  const map = new Map<string, TaxonomyEntry>();
  for (const entry of entries) {
    // Map the canonical ID (lowercased)
    map.set(entry.id.toLowerCase(), entry);
    // Map the label (lowercased)
    map.set(entry.label.toLowerCase(), entry);
    // Map all aliases (lowercased)
    for (const alias of entry.aliases) {
      map.set(alias.toLowerCase(), entry);
    }
  }
  return map;
}

const skillAliasMap = buildAliasMap(SKILL_TAXONOMY);
const interestAliasMap = buildAliasMap(INTEREST_TAXONOMY_ENTRIES);
const locationAliasMap = buildAliasMap(LOCATION_TAXONOMY);

/**
 * Resolve a user-typed string to a canonical taxonomy entry.
 * Returns the entry if found, null otherwise.
 */
export function resolveSkill(raw: string): TaxonomyEntry | null {
  return skillAliasMap.get(raw.toLowerCase().trim()) || null;
}

export function resolveInterest(raw: string): TaxonomyEntry | null {
  return interestAliasMap.get(raw.toLowerCase().trim()) || null;
}

export function resolveLocation(raw: string): TaxonomyEntry | null {
  return locationAliasMap.get(raw.toLowerCase().trim()) || null;
}

/**
 * Resolve an array of user inputs to canonical taxonomy entries.
 * Known values become canonical entries; unknown values are dropped.
 */
export function resolveSkills(rawInputs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawInputs) {
    const entry = resolveSkill(raw);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      result.push(entry.label); // Store canonical label for display
    } else if (!entry) {
      // Unknown skill — preserve as-is but only if not empty
      const trimmed = raw.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed);
      }
    }
  }
  return result;
}

export function resolveInterests(rawInputs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawInputs) {
    const entry = resolveInterest(raw);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      result.push(entry.label);
    } else if (!entry) {
      const trimmed = raw.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed);
      }
    }
  }
  return result;
}

export function resolveLocations(rawInputs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawInputs) {
    const entry = resolveLocation(raw);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      result.push(entry.label);
    } else if (!entry) {
      const trimmed = raw.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed);
      }
    }
  }
  return result;
}

/**
 * Get popular items from a taxonomy (for initial suggestions).
 */
export function getPopularSkills(): TaxonomyEntry[] {
  return SKILL_TAXONOMY.filter((e) => e.popular);
}

export function getPopularInterests(): TaxonomyEntry[] {
  return INTEREST_TAXONOMY_ENTRIES.filter((e) => e.popular);
}

/**
 * Interest chips shown in the Discovery filter panel, with canonical taxonomy
 * values. Display labels stay human-friendly ("AI", "Machine Learning") while
 * both resolve to the SAME canonical value ("AI / ML"), so chip clicks and the
 * natural-language parser write identical URL tokens and the active-state
 * check canonicalizes URL values the same way. Labels not in the taxonomy
 * (e.g. "Python") keep their label as the value.
 */
export const DISCOVERY_INTEREST_OPTIONS: { label: string; value: string }[] = [
  "AI", "Web Development", "Open Source", "Data Science", "Design",
  "Research", "Cybersecurity", "Product Management", "Cloud", "Startups",
  "Mobile", "DevOps", "Python", "Machine Learning", "Fintech",
].map((label) => ({ label, value: resolveInterest(label)?.label ?? label }));

export function getPopularLocations(): TaxonomyEntry[] {
  return LOCATION_TAXONOMY.filter((e) => e.popular);
}

/**
 * Search within a taxonomy by label or alias.
 * Returns matching entries sorted by relevance (label matches first, then alias matches).
 */
export function searchTaxonomy(
  entries: TaxonomyEntry[],
  query: string,
  exclude?: Set<string>
): TaxonomyEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return entries.filter((e) => !exclude?.has(e.id));

  const labelMatches: TaxonomyEntry[] = [];
  const aliasMatches: TaxonomyEntry[] = [];

  for (const entry of entries) {
    if (exclude?.has(entry.id)) continue;

    const labelLower = entry.label.toLowerCase();
    if (labelLower.includes(q)) {
      labelMatches.push(entry);
    } else if (entry.aliases.some((a) => a.toLowerCase().includes(q))) {
      aliasMatches.push(entry);
    }
  }

  return [...labelMatches, ...aliasMatches];
}
