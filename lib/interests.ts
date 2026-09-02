/**
 * Centralized interest taxonomy for OPPY discovery.
 *
 * Each user-facing interest maps to a set of normalized keywords
 * that are matched against opportunity title, tags, description, and organization.
 */

export interface InterestDefinition {
  label: string;
  /** Primary keyword (same as label) */
  primary: string;
  /** All related keywords including the primary */
  keywords: string[];
  /** Related interests that are often co-relevant */
  relatedInterests: string[];
}

export const INTEREST_TAXONOMY: Record<string, InterestDefinition> = {
  "AI / ML": {
    label: "AI / ML",
    primary: "ai",
    keywords: [
      "ai", "artificial intelligence", "machine learning", "ml",
      "deep learning", "llm", "large language model", "generative ai",
      "genai", "nlp", "natural language processing", "computer vision",
      "neural network", "data science", "ml engineer", "ai engineer",
      "tensorflow", "pytorch", "transformer",
    ],
    relatedInterests: ["Data Science", "Research"],
  },
  "Web Development": {
    label: "Web Development",
    primary: "web development",
    keywords: [
      "web development", "frontend", "front-end", "backend", "back-end",
      "full stack", "full-stack", "fullstack", "react", "next.js", "nextjs",
      "vue", "angular", "node", "node.js", "nodejs", "javascript", "typescript",
      "html", "css", "web app", "web application", "saas",
    ],
    relatedInterests: ["Software Engineering", "Design"],
  },
  "Software Engineering": {
    label: "Software Engineering",
    primary: "software engineer",
    keywords: [
      "software engineering", "software engineer", "software developer",
      "developer", "engineering", "backend", "frontend", "full stack",
      "full-stack", "swe", "programmer", "coding", "build",
    ],
    relatedInterests: ["Web Development", "Cloud"],
  },
  "Open Source": {
    label: "Open Source",
    primary: "open source",
    keywords: [
      "open source", "open-source", "open source", "github", "community",
      "foss", "contributor", "maintainer", "oss", "hacktoberfest",
    ],
    relatedInterests: ["Software Engineering"],
  },
  "Data Engineering": {
    label: "Data Engineering",
    primary: "data engineering",
    keywords: [
      "data engineering", "etl", "data pipeline", "airflow", "spark",
      "kafka", "data warehouse", "dbt", "snowflake", "bigquery",
      "data lake", "databricks", "redshift", "data platform",
      "streaming", "batch processing", "data infrastructure",
    ],
    relatedInterests: ["Data Science", "Cloud", "AI / ML"],
  },
  "Data Science": {
    label: "Data Science",
    primary: "data science",
    keywords: [
      "data science", "data scientist", "data analyst", "analytics",
      "python", "statistics", "machine learning", "sql", "data",
      "visualization", "etl", "pipeline", "big data", "pandas",
    ],
    relatedInterests: ["AI / ML", "Research", "Data Engineering"],
  },
  "Design": {
    label: "Design",
    primary: "design",
    keywords: [
      "design", "ui", "ux", "user experience", "user interface",
      "figma", "graphic design", "product design", "visual design",
      "interaction design", "designer", "creative",
    ],
    relatedInterests: ["Product Management", "Web Development"],
  },
  "Research": {
    label: "Research",
    primary: "research",
    keywords: [
      "research", "researcher", "academic", "paper", "publication",
      "laboratory", "lab", "thesis", "phd", "postdoc", "science",
      "investigation", "study",
    ],
    relatedInterests: ["AI / ML", "Data Science"],
  },
  "Cybersecurity": {
    label: "Cybersecurity",
    primary: "cybersecurity",
    keywords: [
      "cybersecurity", "cyber security", "infosec", "information security",
      "security", "penetration testing", "pentest", "vulnerability",
      "encryption", "privacy", "compliance",
    ],
    relatedInterests: ["Cloud"],
  },
  "Product Management": {
    label: "Product Management",
    primary: "product management",
    keywords: [
      "product management", "product manager", "pm", "product",
      "strategy", "roadmap", "user research", "analytics",
    ],
    relatedInterests: ["Design", "Software Engineering"],
  },
  "Cloud": {
    label: "Cloud",
    primary: "cloud",
    keywords: [
      "cloud", "aws", "azure", "gcp", "google cloud",
      "devops", "infrastructure", "kubernetes", "docker",
      "ci/cd", "deployment", "serverless",
    ],
    relatedInterests: ["Cybersecurity", "Software Engineering"],
  },
  "Startups": {
    label: "Startups",
    primary: "startup",
    keywords: [
      "startup", "founder", "founding", "early stage", "seed",
      "venture", "yc", "y combinator", "accelerator", "incubator",
    ],
    relatedInterests: ["Product Management", "Software Engineering"],
  },
  "Mobile": {
    label: "Mobile",
    primary: "mobile",
    keywords: [
      "mobile", "ios", "android", "swift", "kotlin", "react native",
      "flutter", "app development", "mobile app", "cross-platform",
    ],
    relatedInterests: ["Software Engineering", "Design"],
  },
  "DevOps": {
    label: "DevOps",
    primary: "devops",
    keywords: [
      "devops", "sre", "site reliability", "infrastructure",
      "ci/cd", "kubernetes", "docker", "terraform", "cloud",
      "deployment", "automation", "monitoring",
    ],
    relatedInterests: ["Cloud", "Software Engineering"],
  },
};

/** Get all keywords for a given interest label. */
export function getInterestKeywords(interestLabel: string): string[] {
  const def = INTEREST_TAXONOMY[interestLabel];
  if (!def) return [interestLabel.toLowerCase()];
  return def.keywords;
}

/** Get the full set of keywords including related interests. */
export function getExpandedInterestKeywords(interestLabel: string): string[] {
  const def = INTEREST_TAXONOMY[interestLabel];
  if (!def) return [interestLabel.toLowerCase()];

  const allKeywords = [...def.keywords];
  for (const related of def.relatedInterests) {
    const relatedDef = INTEREST_TAXONOMY[related];
    if (relatedDef) {
      // Add only top 5 keywords from related interests to keep it focused
      allKeywords.push(...relatedDef.keywords.slice(0, 5));
    }
  }
  return [...new Set(allKeywords)];
}

/**
 * Check if a text contains a keyword with proper word-boundary matching.
 * Short keywords (≤3 chars) use regex word boundaries to avoid
 * matching substrings like "ai" inside "tr\u00e2\u0080\u008ainers" or "ml" inside "HTML".
 */
export function textContainsKeyword(text: string, keyword: string): boolean {
  if (keyword.length <= 3) {
    // Use word boundaries for short keywords to avoid false positives
    try {
      const pattern = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "i");
      return pattern.test(text);
    } catch {
      return text.includes(keyword);
    }
  }
  // For longer keywords, simple substring match is fine
  return text.includes(keyword);
}

/** Check if a text matches an interest (any of its keywords). */
export function textMatchesInterest(text: string, interestLabel: string): "strong" | "related" | "none" {
  const lower = text.toLowerCase();
  const def = INTEREST_TAXONOMY[interestLabel];
  if (!def) {
    return lower.includes(interestLabel.toLowerCase()) ? "strong" : "none";
  }

  // Check primary keywords
  for (const kw of def.keywords) {
    if (textContainsKeyword(lower, kw)) return "strong";
  }

  // Check related interests
  for (const related of def.relatedInterests) {
    const relatedDef = INTEREST_TAXONOMY[related];
    if (relatedDef) {
      for (const kw of relatedDef.keywords.slice(0, 5)) {
        if (textContainsKeyword(lower, kw)) return "related";
      }
    }
  }

  return "none";
}

/**
 * Location soft matching — determines compatibility level.
 *
 * Returns: "exact" | "country" | "remote_compatible" | "global" | "none"
 */
export function matchLocation(opportunityLocation: string, userLocation: string): "exact" | "country" | "remote_compatible" | "global" | "none" {
  if (!opportunityLocation || !userLocation) return "none";

  const loc = opportunityLocation.toLowerCase().trim();
  const user = userLocation.toLowerCase().trim();

  // Exact location match
  if (loc === user || loc.includes(user) || user.includes(loc)) return "exact";

  // India sub-locations
  const indiaCities = ["bengaluru", "bangalore", "mumbai", "delhi", "hyderabad", "chennai", "pune", "kolkata", "ahmedabad", "jaipur"];
  if (user === "india" || user === "indian") {
    for (const city of indiaCities) {
      if (loc.includes(city) || loc.includes("india")) return "country";
    }
    // Indian locations that don't mention India explicitly
    if (indiaCities.some(city => loc.includes(city))) return "country";
  }

  // Remote compatibility
  if (loc.includes("remote") || loc.includes("online") || loc.includes("work from home")) {
    return "remote_compatible";
  }

  // Global/worldwide
  if (loc.includes("global") || loc.includes("worldwide") || loc.includes("international")) {
    return "global";
  }

  return "none";
}

/** Check if an opportunity is student-relevant based on title, tags, description. */
export function isStudentRelevant(opp: { title: string; tags: string[]; description: string; organization?: string }): boolean {
  const text = `${opp.title} ${(opp.tags || []).join(" ")} ${opp.description} ${opp.organization || ""}`.toLowerCase();
  const studentTerms = [
    "student", "campus", "undergraduate", "graduate", "university",
    "college", "bachelor", "masters", "phd", "academic",
    "intern", "internship", "entry level", "entry-level", "junior",
    "ambassador", "fellow", "scholarship",
  ];
  return studentTerms.some(term => text.includes(term));
}

/** Check if opportunity uses professional/senior language. */
export function isProfessionalRelevant(opp: { title: string; tags: string[]; description: string }): boolean {
  const text = `${opp.title} ${(opp.tags || []).join(" ")} ${opp.description}`.toLowerCase();
  const proTerms = [
    "senior", "staff", "principal", "lead", "director", "manager",
    "experienced", "professional", "expert",
  ];
  return proTerms.some(term => text.includes(term));
}
