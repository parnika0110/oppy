import { describe, it, expect } from "vitest";

/**
 * Test the HN semantic tag extraction logic.
 * This mirrors the extractSemanticTags function in scripts/hn-reprocess-tags.ts
 * and the parseComment function in lib/ingestion/sources/hackernews.ts.
 */

function extractSemanticTags(title: string, description: string): string[] {
  const tags: string[] = [];
  const combined = `${title} ${description}`.toLowerCase();

  if (/\b(ml|machine learning|ai|artificial intelligence|deep learning|nlp|computer vision|llm|data scien)/.test(combined)) {
    tags.push("ai/ml");
  }
  if (/\b(frontend|front-end|ui |react |vue |angular |css |html )/.test(combined)) {
    tags.push("frontend");
  }
  if (/\b(backend|back-end|server|api |infrastructure|distributed)/.test(combined)) {
    tags.push("backend");
  }
  if (/\b(full.?stack|fullstack)/.test(combined)) {
    tags.push("full-stack");
  }
  if (/\b(devops|sre|infra|cloud|kubernetes|docker|terraform)/.test(combined)) {
    tags.push("devops");
  }
  if (/\b(security|infosec|cyber|pentest)/.test(combined)) {
    tags.push("security");
  }
  if (/\b(mobile|ios|android|swift|kotlin|flutter|react native)/.test(combined)) {
    tags.push("mobile");
  }
  if (/\b(data |analytics|etl|pipeline|warehouse|spark)/.test(combined)) {
    tags.push("data");
  }
  if (/\b(product|pm |product manager|product design)/.test(combined)) {
    tags.push("product");
  }
  if (/\b(design|designer|ux|ui design|figma|visual)/.test(combined)) {
    tags.push("design");
  }

  const techKeywords = [
    "python", "javascript", "typescript", "rust", "go", "java",
    "react", "node", "vue", "angular", "django", "flask", "fastapi",
    "postgresql", "redis", "kafka", "aws", "gcp", "azure",
  ];
  for (const kw of techKeywords) {
    if (tags.length >= 5) break;
    try {
      const pattern = new RegExp(`\\b${kw}(\\.js)?\\b`, "i");
      if (pattern.test(combined)) {
        tags.push(kw === "go" ? "golang" : kw);
      }
    } catch { /* skip invalid regex */ }
  }

  if (combined.includes("remote")) tags.push("remote");
  if (combined.includes("intern")) tags.push("internship");

  return [...new Set(tags)].slice(0, 6);
}

describe("HN semantic tag extraction", () => {
  it("extracts AI/ML tags from AI engineer role", () => {
    const tags = extractSemanticTags("AI Engineer — Python, PyTorch, LLM", "Building large language models for production");
    expect(tags).toContain("ai/ml");
    expect(tags).toContain("python");
  });

  it("extracts frontend tags from React role", () => {
    const tags = extractSemanticTags("Frontend Engineer — React, TypeScript", "Building modern web applications");
    expect(tags).toContain("frontend");
    expect(tags).toContain("react");
    expect(tags).toContain("typescript");
  });

  it("extracts backend tags from Go role", () => {
    const tags = extractSemanticTags("Backend Engineer — Go", "Distributed systems and APIs");
    expect(tags).toContain("backend");
    expect(tags).toContain("golang");
  });

  it("extracts devops tags from SRE role", () => {
    const tags = extractSemanticTags("SRE — Kubernetes, Terraform", "Infrastructure and reliability engineering");
    expect(tags).toContain("devops");
  });

  it("extracts security tags", () => {
    const tags = extractSecurityTags("Security Engineer", "Penetration testing and vulnerability research");
    expect(tags).toContain("security");
  });

  it("extracts mobile tags", () => {
    const tags = extractSemanticTags("iOS Engineer — Swift", "Building mobile apps for iOS");
    expect(tags).toContain("mobile");
  });

  it("extracts product tags", () => {
    const tags = extractSemanticTags("Product Manager", "Leading product strategy and roadmap");
    expect(tags).toContain("product");
  });

  it("extracts design tags", () => {
    const tags = extractSemanticTags("UI/UX Designer", "Creating beautiful user interfaces with Figma");
    expect(tags).toContain("design");
  });

  it("detects remote work", () => {
    const tags = extractSemanticTags("Software Engineer", "Remote position available");
    expect(tags).toContain("remote");
  });

  it("detects internship", () => {
    const tags = extractSemanticTags("ML Intern", "Summer internship in machine learning");
    expect(tags).toContain("internship");
    expect(tags).toContain("ai/ml");
  });

  it("extracts data science tags", () => {
    const tags = extractSemanticTags("Data Scientist", "Analytics and machine learning pipeline");
    expect(tags).toContain("ai/ml");
    expect(tags).toContain("data");
  });

  it("full-stack detection", () => {
    const tags = extractSemanticTags("Full Stack Engineer", "React frontend, Node.js backend");
    expect(tags).toContain("full-stack");
  });

  it("does not give generic tags to design role", () => {
    const tags = extractSemanticTags("Designer", "Visual design and Figma");
    expect(tags).toContain("design");
    expect(tags).not.toContain("ai/ml");
    expect(tags).not.toContain("backend");
  });
});

function extractSecurityTags(title: string, description: string): string[] {
  return extractSemanticTags(title, description);
}
