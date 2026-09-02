/**
 * Safe input normalization for user-typed interests and skills.
 *
 * Handles:
 * - trimming whitespace
 * - normalizing case
 * - safe/common typo corrections (high confidence only)
 * - common synonyms/abbreviations
 *
 * Preserves original text for unknown/ambiguous values.
 * NEVER silently converts low-confidence arbitrary text.
 */

// ── Typo corrections (high-confidence, common misspellings) ──────────────

const TYPO_CORRECTIONS: Record<string, string> = {
  // Programming languages
  "pyhton": "Python",
  "pythonn": "Python",
  "pyton": "Python",
  "javscript": "JavaScript",
  "javascrpt": "JavaScript",
  "javasript": "JavaScript",
  "typescript": "TypeScript",
  "typescrpt": "TypeScript",
  "cpluspus": "C++",
  "cplusu": "C++",
  "cshrp": "C#",
  "csharp": "C#",

  // Fields / domains
  "machne learning": "Machine Learning",
  "machine learing": "Machine Learning",
  "machne learing": "Machine Learning",
  "data enginering": "Data Engineering",
  "data enginerring": "Data Engineering",
  "data scence": "Data Science",
  "data scinece": "Data Science",
  "artifical intelligence": "Artificial Intelligence",
  "artificial intellegence": "Artificial Intelligence",
  "deep learing": "Deep Learning",
  "neural neworks": "Neural Networks",
  "web developement": "Web Development",
  "web develoment": "Web Development",
  "front end": "Frontend",
  "back end": "Backend",
  "full stck": "Full Stack",
  "fullstck": "Full Stack",
  "full stak": "Full Stack",

  // Tools / platforms
  "reactjs": "React",
  "react.js": "React",
  "nextjs": "Next.js",
  "next.js": "Next.js",
  "nodejs": "Node.js",
  "node.js": "Node.js",
  "vuejs": "Vue.js",
  "vue.js": "Vue.js",
  "angualr": "Angular",
  "anguler": "Angular",
  "kubernets": "Kubernetes",
  "kuberentes": "Kubernetes",
  "dockers": "Docker",
  "tensoflow": "TensorFlow",
  "tensors": "TensorFlow",
  "pytorch": "PyTorch",
  "pytorh": "PyTorch",

  // Concepts
  "devops": "DevOps",
  "dev ops": "DevOps",
  "devlopment": "Development",
  "developement": "Development",
  "programing": "Programming",
  "programmming": "Programming",
  "algoriths": "Algorithms",
  "algorithm": "Algorithms",
  "cybersecuirty": "Cybersecurity",
  "cyber secuirty": "Cybersecurity",
  "infomation security": "Information Security",
  "producr management": "Product Management",
  "product managment": "Product Management",
  "ui/ux": "UI/UX",
  "ux/ui": "UI/UX",
  "figma": "Figma",
  "graphql": "GraphQL",
  "graph QL": "GraphQL",
  "aws": "AWS",
  "gcp": "GCP",
  "azure": "Azure",
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
};

// ── Synonym/abbreviation mappings (bidirectional) ────────────────────────

const SYNONYM_MAP: Record<string, string> = {
  // Abbreviations → canonical
  "ml": "Machine Learning",
  "ai": "AI / ML",
  "dl": "Deep Learning",
  "nlp": "NLP",
  "cv": "Computer Vision",
  "ds": "Data Science",
  "de": "Data Engineering",
  "pm": "Product Management",
  "ux": "UX Design",
  "ui": "UI Design",
  "devops": "DevOps",
  "sre": "Site Reliability Engineering",
  "oss": "Open Source",
  "foss": "Open Source",
  "fe": "Frontend",
  "be": "Backend",
  "fs": "Full Stack",
  "mlops": "MLOps",
  "web3": "Web3",
  "db": "Databases",
  "sql": "SQL",
  "nosql": "NoSQL",
};

// ── Normalization function ───────────────────────────────────────────────

/**
 * Normalize a single user-typed interest/skill string.
 *
 * Returns the canonical form if a high-confidence match exists,
 * otherwise returns the trimmed, case-normalized original.
 */
export function normalizeInput(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Step 1: Lowercase for matching
  const lower = trimmed.toLowerCase();

  // Step 2: Check exact typo correction
  if (TYPO_CORRECTIONS[lower]) {
    return TYPO_CORRECTIONS[lower];
  }

  // Step 3: Check synonym/abbreviation
  if (SYNONYM_MAP[lower]) {
    return SYNONYM_MAP[lower];
  }

  // Step 4: Normalize case — capitalize first letter of each word
  // But preserve all-caps abbreviations (e.g., "AWS", "CI/CD")
  if (trimmed === trimmed.toUpperCase() && trimmed.length <= 5) {
    return trimmed; // Keep abbreviations as-is
  }

  // Title case for multi-word inputs
  return trimmed
    .split(/\s+/)
    .map((word) => {
      // Keep all-caps words (abbreviations)
      if (word === word.toUpperCase() && word.length <= 5) return word;
      // Capitalize first letter, lowercase rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Normalize a comma-separated list of user inputs.
 * Returns an array of normalized, deduplicated values.
 */
export function normalizeInputList(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];

  const normalized = raw
    .split(",")
    .map((s) => normalizeInput(s))
    .filter((s) => s.length > 0);

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  return normalized.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
