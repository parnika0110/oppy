import "server-only";
import type { ResumeProfile } from "@/lib/userAuth";
import { resolveSkill, resolveInterest } from "@/lib/taxonomies";

// ── Known technology keywords ──────────────────────────────────────────

const TECH_KEYWORDS = new Set([
  // Languages
  "python", "javascript", "typescript", "java", "c++", "c#", "ruby", "go", "rust", "php",
  "swift", "kotlin", "scala", "r", "matlab", "sql", "html", "css", "sass", "scss",
  "graphql", "json", "yaml", "xml", "bash", "shell", "perl",
  // Frameworks & Libraries
  "react", "angular", "vue", "vue.js", "next.js", "nextjs", "nuxt", "svelte",
  "node.js", "nodejs", "express", "fastapi", "flask", "django", "spring", "spring boot",
  "rails", "ruby on rails", "laravel", ".net", "dotnet",
  "tensorflow", "pytorch", "keras", "scikit-learn", "scikit learn", "pandas", "numpy",
  "opencv", "hugging face", "langchain", "openai",
  // Databases
  "mongodb", "mysql", "postgresql", "postgres", "redis", "elasticsearch", "firebase",
  "dynamodb", "cassandra", "sqlite", "neo4j", "supabase",
  // Cloud & DevOps
  "aws", "gcp", "google cloud", "azure", "docker", "kubernetes", "k8s", "terraform",
  "jenkins", "github actions", "ci/cd", "nginx", "linux", "unix",
  // Mobile
  "flutter", "react native", "android", "ios", "swiftui", "jetpack compose",
  // Game
  "unity", "unreal", "unreal engine", "godot", "blender",
  // Other Tools
  "git", "figma", "photoshop", "illustrator", "jira", "confluence", "slack",
  "vscode", "vim", "neovim", "postman", "docker compose",
  // AI/ML
  "machine learning", "deep learning", "nlp", "natural language processing",
  "computer vision", "data science", "neural networks", "transformers",
  "cuda", "onnx", "mlflow", "airflow", "dbt",
]);

// ── Section detection patterns ─────────────────────────────────────────

const SECTION_PATTERNS: Record<string, RegExp[]> = {
  experience: [
    /^(?:work\s+)?experience$/i,
    /^(?:professional|employment)\s+experience$/i,
    /^(?:work|career)\s+history$/i,
    /^internship(?:s)?$/i,
  ],
  education: [
    /^education$/i,
    /^academic(?:\s+background)?$/i,
  ],
  projects: [
    /^(?:personal\s+)?projects?$/i,
    /^side\s+projects?$/i,
    /^portfolio$/i,
  ],
  skills: [
    /^technical\s+skills?$/i,
    /^skills?$/i,
    /^tech\s+stack$/i,
    /^competencies$/i,
    /^tools?\s*(?:&|and)\s*technologies$/i,
  ],
  certifications: [
    /^certifications?$/i,
    /^licenses?\s*(?:&|and)\s*certifications?$/i,
  ],
  achievements: [
    /^achievements?$/i,
    /^awards?$/i,
    /^honors?$/i,
    /^accomplishments?$/i,
  ],
};

// ── Experience duration pattern ────────────────────────────────────────

const DURATION_PATTERN = /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{4}\s*[-–—to]+\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|present|current)\s*\d{0,4}/i;

// ── Core extraction ────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

/**
 * Extract text from a DOCX buffer.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

/**
 * Detect sections in the resume text and return a map of section name → lines.
 */
function detectSections(text: string): Map<string, string[]> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections = new Map<string, string[]>();
  const sectionOrder: string[] = [];

  for (const line of lines) {
    let foundSection: string | null = null;

    for (const [sectionName, patterns] of Object.entries(SECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          foundSection = sectionName;
          break;
        }
      }
      if (foundSection) break;
    }

    if (foundSection) {
      sectionOrder.push(foundSection);
      sections.set(foundSection, []);
    } else if (sectionOrder.length > 0) {
      const currentSection = sectionOrder[sectionOrder.length - 1];
      sections.get(currentSection)!.push(line);
    }
  }

  return sections;
}

/**
 * Extract skills from skills section text and from the full resume text.
 */
function extractSkills(sections: Map<string, string[]>, fullText: string): string[] {
  const skills = new Set<string>();

  // First try the skills section
  const skillLines = sections.get("skills") || [];
  for (const line of skillLines) {
    // Split by common delimiters
    const parts = line.split(/[,•·|;\/]+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      // Try resolving through taxonomy
      const resolved = resolveSkill(part);
      if (resolved) {
        skills.add(resolved.label);
      } else if (TECH_KEYWORDS.has(part.toLowerCase())) {
        skills.add(part);
      }
    }
  }

  // Also scan the full text for known technologies
  const lowerText = fullText.toLowerCase();
  for (const tech of TECH_KEYWORDS) {
    // Use word boundary matching to avoid false positives
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lowerText)) {
      const resolved = resolveSkill(tech);
      if (resolved) {
        skills.add(resolved.label);
      } else {
        skills.add(tech.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
      }
    }
  }

  return Array.from(skills);
}

/**
 * Extract interests (domains/areas) from the resume.
 */
function extractInterests(fullText: string): string[] {
  const interests = new Set<string>();
  const lowerText = fullText.toLowerCase();

  // Map of domain keywords → canonical interest labels
  const domainMap: Array<[RegExp, string]> = [
    [/\b(?:machine\s*learning|ml|deep\s*learning|neural\s*network|ai)\b/i, "AI / ML"],
    [/\b(?:game\s*dev|game\s*develop|unity|unreal|godot|godot|gameplay)\b/i, "Game Dev"],
    [/\b(?:mobile\s*app|android\s*dev|ios\s*dev|flutter|react\s*native)\b/i, "Mobile"],
    [/\b(?:backend|server[\s-]?side|api\s*dev|rest\s*api|graphql)\b/i, "Backend Development"],
    [/\b(?:frontend|front[\s-]?end|client[\s-]?side|ui\s*dev|ux)\b/i, "Frontend Development"],
    [/\b(?:full[\s-]?stack|end[\s-]?to[\s-]?end|mern|mean|lamp)\b/i, "Full Stack Development"],
    [/\b(?:devops|ci[\s/]?cd|infrastructure|kubernetes|docker|terraform)\b/i, "DevOps"],
    [/\b(?:data\s*science|data\s*analy|analytics|business\s*intellig)\b/i, "Data Science"],
    [/\b(?:cybersecurity|security|penetration\s*test|infosec)\b/i, "Cybersecurity"],
    [/\b(?:cloud|aws|gcp|azure)\b/i, "Cloud"],
    [/\b(?:embedded|firmware|iot|internet\s*of\s*things)\b/i, "Embedded Systems"],
    [/\b(?:blockchain|web3|crypto|defi|smart\s*contract)\b/i, "Blockchain / Web3"],
    [/\b(?:ux|ui|figma|sketch|user\s*experience|user\s*interface)\b/i, "Design"],
    [/\b(?:open[\s-]?source|oss|github\s*contrib|pull\s*request)\b/i, "Open Source"],
    [/\b(?:hackathon|hack\s*jam|coding\s*competition)\b/i, "Hackathon"],
    [/\b(?:startup|founder|entrepreneur|venture)\b/i, "Startups"],
    [/\b(?:research|paper|publication|journal|arxiv)\b/i, "Research"],
    [/\b(?:teaching|mentor|tutor|education\s*tech)\b/i, "Teaching"],
    [/\b(?:sustainability|climate|clean\s*tech|green)\b/i, "Sustainability / Climate"],
    [/\b(?:ar|vr|mixed\s*reality|augmented\s*reality|virtual\s*reality)\b/i, "AR / VR"],
  ];

  for (const [pattern, interest] of domainMap) {
    if (pattern.test(fullText)) {
      // Resolve through taxonomy for canonical labels
      const resolved = resolveInterest(interest);
      interests.add(resolved?.label || interest);
    }
  }

  return Array.from(interests);
}

/**
 * Extract projects from the projects section.
 */
function extractProjects(sections: Map<string, string[]>): ResumeProfile["projects"] {
  const projectLines = sections.get("projects") || [];
  const projects: ResumeProfile["projects"] = [];

  // Try to detect individual project blocks
  // Heuristic: a new project starts when we see a bold/heading-like line or a bullet
  let currentProject: Partial<ResumeProfile["projects"][0]> | null = null;

  for (const line of projectLines) {
    const trimmed = line.replace(/^[-•*▸►▪◦]+/, "").trim();

    // Check if this line looks like a project title (short, possibly bold/camelCase)
    const looksLikeTitle =
      trimmed.length > 0 &&
      trimmed.length < 80 &&
      !trimmed.includes(",") &&
      !/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(trimmed) &&
      !DURATION_PATTERN.test(trimmed);

    if (looksLikeTitle && (!currentProject || currentProject.title)) {
      // Save previous project
      if (currentProject?.title) {
        projects.push({
          title: currentProject.title,
          technologies: currentProject.technologies || [],
          description: currentProject.description,
        });
      }
      currentProject = { title: trimmed, technologies: [], description: "" };
    } else if (currentProject) {
      // Check for tech stack mentions
      const techMatch = trimmed.match(/(?:built with|using|tech[\s:]+|stack[\s:]+|technologies[\s:]+)(.+)/i);
      if (techMatch) {
        const techs = techMatch[1]
          .split(/[,•·|\/]+/)
          .map((t) => t.trim())
          .filter(Boolean);
        currentProject.technologies = [...(currentProject.technologies || []), ...techs];
      } else {
        // Accumulate as description
        currentProject.description = currentProject.description
          ? `${currentProject.description} ${trimmed}`
          : trimmed;
      }
    }
  }

  // Save last project
  if (currentProject?.title) {
    projects.push({
      title: currentProject.title,
      technologies: currentProject.technologies || [],
      description: currentProject.description,
    });
  }

  return projects;
}

/**
 * Extract work/internship experience.
 */
function extractExperience(sections: Map<string, string[]>): ResumeProfile["experience"] {
  const expLines = sections.get("experience") || [];
  const experiences: ResumeProfile["experience"] = [];

  let current: Partial<ResumeProfile["experience"][0]> | null = null;

  for (const line of expLines) {
    const trimmed = line.replace(/^[-•*▸►▪◦]+/, "").trim();

    // Check for duration pattern
    const durationMatch = trimmed.match(DURATION_PATTERN);

    // Check if this is a role/organization line (contains duration or looks like a heading)
    if (durationMatch || (trimmed.length > 0 && trimmed.length < 80 && !current?.role)) {
      if (current?.role) {
        experiences.push({
          role: current.role,
          organization: current.organization || "",
          duration: current.duration,
          description: current.description,
        });
      }

      // Try to parse role and organization
      const parts = trimmed.split(/\s*[|–—·•]\s*|\s+at\s+/i);
      current = {
        role: parts[0]?.trim() || trimmed,
        organization: parts[1]?.trim() || "",
        duration: durationMatch?.[0] || undefined,
        description: "",
      };
    } else if (current) {
      current.description = current.description
        ? `${current.description} ${trimmed}`
        : trimmed;
    }
  }

  if (current?.role) {
    experiences.push({
      role: current.role,
      organization: current.organization || "",
      duration: current.duration,
      description: current.description,
    });
  }

  return experiences;
}

/**
 * Extract education entries.
 */
function extractEducation(sections: Map<string, string[]>): ResumeProfile["education"] {
  const eduLines = sections.get("education") || [];
  const education: ResumeProfile["education"] = [];

  for (const line of eduLines) {
    const trimmed = line.replace(/^[-•*▸►▪◦]+/, "").trim();
    if (trimmed.length < 3) continue;

    // Try to extract degree and institution
    const degreeMatch = trimmed.match(
      /((?:bachelor|master|ph\.?d?|b\.?s\.?|m\.?s\.?|b\.?tech|m\.?tech|bca|mca|mba|b\.?e\.?|m\.?e\.?)\s*(?:of|in|in\s+)?\s*[^,]*)/i
    );
    const yearMatch = trimmed.match(/\b(20\d{2})\b/);
    const institutionMatch = trimmed.match(
      /(?:at|from|—|–|·)\s*(.+?)(?:\s*\(|$)/i
    );

    education.push({
      institution: institutionMatch?.[1]?.trim() || trimmed,
      degree: degreeMatch?.[1]?.trim() || undefined,
      field: undefined,
      year: yearMatch?.[1] || undefined,
    });
  }

  return education;
}

/**
 * Extract achievements/awards.
 */
function extractAchievements(sections: Map<string, string[]>): string[] {
  const lines = sections.get("achievements") || [];
  return lines
    .map((l) => l.replace(/^[-•*▸►▪◦]+/, "").trim())
    .filter((l) => l.length > 2);
}

/**
 * Main parsing function: extract structured information from resume text.
 */
export async function parseResume(
  buffer: Buffer,
  mimeType: string
): Promise<ResumeProfile> {
  let text: string;

  if (mimeType === "application/pdf") {
    text = await extractPdfText(buffer);
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    text = await extractDocxText(buffer);
  } else {
    throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
  }

  if (!text || text.trim().length < 50) {
    throw new Error("Could not extract meaningful text from the resume. Please try a different file.");
  }

  const sections = detectSections(text);
  const extractedSkills = extractSkills(sections, text);
  const extractedInterests = extractInterests(text);
  const projects = extractProjects(sections);
  const experience = extractExperience(sections);
  const education = extractEducation(sections);
  const achievements = extractAchievements(sections);

  // Derive domains from skills + interests
  const domains = Array.from(new Set([
    ...extractedInterests,
    ...extractedSkills
      .map((s) => resolveSkill(s))
      .filter(Boolean)
      .flatMap((s) => s!.aliases.slice(0, 1)),
  ]));

  return {
    uploaded: true,
    extractedSkills,
    extractedInterests,
    projects,
    experience,
    education,
    achievements,
    domains,
    parsedAt: new Date(),
  };
}
