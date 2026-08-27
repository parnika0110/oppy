import { describe, it, expect } from "vitest";

// Inline the function for testing since it's not exported from the adapter module.
// Mirrors the logic in lib/ingestion/sources/internshala.ts exactly.

const CATEGORY_TAGS: Record<string, string[]> = {
  "cs": ["software-engineering", "cs"],
  "web": ["web-development", "frontend", "backend"],
  "data": ["data-science", "ml", "analytics"],
  "ml": ["machine-learning", "ai", "deep-learning"],
  "design": ["ui-ux", "design", "figma"],
  "marketing": ["marketing", "growth", "seo"],
  "business": ["business", "finance", "operations"],
  "content": ["content", "writing", "copywriting"],
};

function extractRoleTags(title: string, baseTags: string[]): string[] {
  const lower = title.toLowerCase();
  const tags: string[] = [];

  // AI / ML roles
  if (/\b(ai|machine learning|ml|deep learning|artificial intelligence|nlp|natural language|computer vision|data science|data analyst|analytics|llm|genai|generative)\b/.test(lower)) {
    tags.push("ai", "machine-learning", "python");
  }

  // Software Engineering roles
  // Note: "intern" alone is NOT a software engineering signal
  if (/\b(software|developer|engineer|programming|coding|backend|frontend|full.?stack|swe|technical)\b/.test(lower)) {
    tags.push("software-engineering");
    if (/\b(python|java|c\+\+|golang|rust|node|spring|django)\b/.test(lower)) tags.push("backend");
    if (/\b(react|angular|vue|frontend|front.?end|ui)\b/.test(lower)) tags.push("frontend");
  }

  // Web Development roles
  if (/\b(web|frontend|front.?end|backend|back.?end|full.?stack|react|angular|vue|node|javascript|typescript|html|css|php|django|flask|next\.?js)\b/.test(lower)) {
    tags.push("web-development");
    if (/\b(react|angular|vue|frontend|front.?end|ui|html|css)\b/.test(lower)) tags.push("frontend");
    if (/\b(node|django|flask|backend|back.?end|php|api)\b/.test(lower)) tags.push("backend");
  }

  // Data Science roles
  if (/\b(data science|data scientist|data analyst|analytics|bi |business intelligence)\b/.test(lower)) {
    tags.push("data-science", "analytics", "python");
  }

  // Design roles
  if (/\b(design|ui|ux|figma|graphic|visual|product design|creative)\b/.test(lower)) {
    tags.push("design", "ui-ux");
    if (/\b(graphic|visual|illustration|photoshop|illustrator)\b/.test(lower)) tags.push("graphic-design");
  }

  // Marketing roles
  if (/\b(marketing|digital marketing|social media|seo|sem|content marketing|growth|brand)\b/.test(lower)) {
    tags.push("marketing", "growth");
    if (/\b(seo|sem|search engine)\b/.test(lower)) tags.push("seo");
    if (/\b(social media|instagram|linkedin)\b/.test(lower)) tags.push("social-media");
  }

  // Content Writing roles
  if (/\b(content|writing|copywriting|copywriter|editorial|editor|blog|technical writing)\b/.test(lower)) {
    tags.push("content", "writing", "copywriting");
  }

  // HR roles — use "resources?" to match both "resource" and "resources"
  if (/\b(hr|human resources?|recruiting|recruitment|talent acquisition|people|people operations)\b/.test(lower)) {
    tags.push("human-resources", "recruiting");
  }

  // Sales roles
  if (/\b(sales|business development|b2b|account|revenue|lead generation)\b/.test(lower)) {
    tags.push("sales", "business-development");
  }

  // Finance roles
  if (/\b(finance|accounting|financial|investment|banking|audit|tax)\b/.test(lower)) {
    tags.push("finance", "accounting");
  }

  // Business / Operations roles
  if (/\b(business|operations|strategy|consulting|management|project management)\b/.test(lower)) {
    tags.push("business", "operations");
  }

  // Customer Service roles
  if (/\b(customer|support|service|helpdesk|call center|telecalling)\b/.test(lower)) {
    tags.push("customer-service", "support");
  }

  // Cybersecurity roles — match full word "cybersecurity" or standalone "cyber"
  if (/\b(cybersecurity|cyber security|infosec|penetration|vulnerability|encryption|security engineer)\b/.test(lower)) {
    tags.push("cybersecurity", "security");
  }

  // Mobile Development roles
  if (/\b(mobile|android|ios|swift|kotlin|flutter|react native)\b/.test(lower)) {
    tags.push("mobile", "app-development");
  }

  // DevOps roles
  if (/\b(devops|cloud|aws|azure|gcp|docker|kubernetes|sre|infrastructure)\b/.test(lower)) {
    tags.push("devops", "cloud");
  }

  // Always add internship tag
  tags.push("internship");

  // If no specific role matched, use baseTags as fallback
  if (tags.length <= 1) {
    return [...baseTags, "internship", "internshala"];
  }

  return [...new Set([...tags, "internshala"])];
}

describe("Internshala tag extraction", () => {
  it("extracts AI/ML tags from ML Intern title", () => {
    const tags = extractRoleTags("Machine Learning Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("ai");
    expect(tags).toContain("machine-learning");
    expect(tags).toContain("python");
    expect(tags).toContain("internship");
    expect(tags).toContain("internshala");
    expect(tags).not.toContain("marketing");
  });

  it("extracts Data Science tags", () => {
    const tags = extractRoleTags("Data Science Intern", CATEGORY_TAGS["data"]);
    expect(tags).toContain("data-science");
    expect(tags).toContain("analytics");
    expect(tags).toContain("python");
    expect(tags).not.toContain("marketing");
  });

  it("extracts Web Development tags from Frontend title", () => {
    const tags = extractRoleTags("Frontend Developer Intern", CATEGORY_TAGS["web"]);
    expect(tags).toContain("web-development");
    expect(tags).toContain("frontend");
    expect(tags).toContain("software-engineering"); // developer matches
    expect(tags).not.toContain("marketing");
  });

  it("extracts Marketing tags from Marketing title", () => {
    const tags = extractRoleTags("Digital Marketing Intern", CATEGORY_TAGS["marketing"]);
    expect(tags).toContain("marketing");
    expect(tags).toContain("growth");
    expect(tags).not.toContain("ai");
    expect(tags).not.toContain("machine-learning");
    expect(tags).not.toContain("software-engineering");
  });

  it("extracts Social Media tags when explicitly mentioned", () => {
    const tags = extractRoleTags("Social Media Marketing Intern", CATEGORY_TAGS["marketing"]);
    expect(tags).toContain("marketing");
    expect(tags).toContain("social-media");
  });

  it("extracts HR tags from HR title", () => {
    const tags = extractRoleTags("Human Resources Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("human-resources");
    expect(tags).toContain("recruiting");
    expect(tags).not.toContain("software-engineering");
    expect(tags).not.toContain("ai");
  });

  it("extracts Talent Acquisition tags", () => {
    const tags = extractRoleTags("Talent Acquisition Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("human-resources");
    expect(tags).toContain("recruiting");
    expect(tags).not.toContain("software-engineering");
  });

  it("extracts Sales tags from Sales title", () => {
    const tags = extractRoleTags("Sales and Marketing Intern", CATEGORY_TAGS["marketing"]);
    expect(tags).toContain("sales");
    expect(tags).toContain("business-development");
    expect(tags).toContain("marketing"); // also matches marketing
    expect(tags).not.toContain("ai");
  });

  it("extracts Design tags from UI/UX title", () => {
    const tags = extractRoleTags("UI/UX Design Intern", CATEGORY_TAGS["design"]);
    expect(tags).toContain("design");
    expect(tags).toContain("ui-ux");
    expect(tags).not.toContain("marketing");
  });

  it("extracts Content Writing tags", () => {
    const tags = extractRoleTags("Content Writing Intern", CATEGORY_TAGS["content"]);
    expect(tags).toContain("content");
    expect(tags).toContain("writing");
    expect(tags).toContain("copywriting");
    expect(tags).not.toContain("ai");
  });

  it("extracts Software Engineering tags from Backend title", () => {
    const tags = extractRoleTags("Python Backend Developer Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("software-engineering");
    expect(tags).toContain("backend");
    expect(tags).not.toContain("marketing");
  });

  it("extracts Cybersecurity tags", () => {
    const tags = extractRoleTags("Cybersecurity Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("cybersecurity");
    expect(tags).toContain("security");
    expect(tags).not.toContain("marketing");
  });

  it("extracts Finance tags", () => {
    const tags = extractRoleTags("Finance Intern", CATEGORY_TAGS["business"]);
    expect(tags).toContain("finance");
    expect(tags).toContain("accounting");
    expect(tags).not.toContain("ai");
  });

  it("extracts Mobile Development tags", () => {
    const tags = extractRoleTags("Android Developer Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("mobile");
    expect(tags).toContain("app-development");
    expect(tags).toContain("software-engineering"); // developer matches
    expect(tags).not.toContain("marketing");
  });

  it("extracts DevOps tags", () => {
    const tags = extractRoleTags("AWS Cloud DevOps Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("devops");
    expect(tags).toContain("cloud");
    expect(tags).not.toContain("marketing");
  });

  it("extracts Customer Service tags", () => {
    const tags = extractRoleTags("Customer Support Intern", CATEGORY_TAGS["cs"]);
    expect(tags).toContain("customer-service");
    expect(tags).toContain("support");
    expect(tags).not.toContain("ai");
  });

  it("falls back to baseTags for generic titles", () => {
    const baseTags = ["marketing", "growth", "seo"];
    const tags = extractRoleTags("General Intern", baseTags);
    expect(tags).toContain("marketing");
    expect(tags).toContain("growth");
    expect(tags).toContain("internship");
    expect(tags).toContain("internshala");
  });

  it("does not cross-contaminate tags between unrelated roles", () => {
    const tags = extractRoleTags("Marketing Intern", CATEGORY_TAGS["cs"]);
    // Should have marketing tags, NOT software-engineering or ai
    expect(tags).toContain("marketing");
    expect(tags).not.toContain("software-engineering");
    expect(tags).not.toContain("ai");
    expect(tags).not.toContain("machine-learning");
  });

  it("extracts SEO-specific tags", () => {
    const tags = extractRoleTags("SEO Marketing Intern", CATEGORY_TAGS["marketing"]);
    expect(tags).toContain("marketing");
    expect(tags).toContain("seo");
  });

  it("extracts Blog Writing tags", () => {
    const tags = extractRoleTags("Blog Writing and Content Intern", CATEGORY_TAGS["content"]);
    expect(tags).toContain("content");
    expect(tags).toContain("writing");
  });

  it("extracts Project Management tags", () => {
    const tags = extractRoleTags("Project Management Intern", CATEGORY_TAGS["business"]);
    expect(tags).toContain("business");
    expect(tags).toContain("operations");
  });
});
