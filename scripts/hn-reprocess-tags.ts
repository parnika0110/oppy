/**
 * HN Record Tag Reprocessing
 *
 * Re-processes existing HN records with improved semantic tag extraction.
 * Does NOT fetch from HN again — only updates tags for existing records.
 *
 * Usage: node --env-file=.env.local --import tsx scripts/hn-reprocess-tags.ts
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || "oppy";

function extractSemanticTags(title: string, description: string): string[] {
  const tags: string[] = [];
  const combined = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // Domain tags
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

  // Technology tags
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

  // Work arrangement
  if (combined.includes("remote")) tags.push("remote");
  if (combined.includes("intern")) tags.push("internship");

  // Company type
  if (combined.includes("startup") || combined.includes("early stage")) {
    tags.push("startup");
  }

  return [...new Set(tags)].slice(0, 6);
}

function extractLocation(description: string): string {
  const firstLine = description.split("\n")[0] || "";
  const pipeParts = firstLine.split("|").map((s: string) => s.trim());
  if (pipeParts.length >= 3) {
    const loc = pipeParts[2];
    if (loc && !loc.match(/^(remote|onsite|hybrid|full.?time|part.?time|contract)$/i)) {
      return loc;
    }
  }
  if (firstLine.toLowerCase().includes("remote")) return "Remote";
  return "See posting";
}

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection("opportunities");

  const hnRecords = await col.find({ source: "Hacker News" }).toArray();
  console.log(`Found ${hnRecords.length} HN records\n`);

  let updated = 0;
  let unchanged = 0;

  for (const opp of hnRecords) {
    const newTags = extractSemanticTags(opp.title || "", opp.description || "");
    const oldTags = (opp.tags || []).sort().join(",");
    const newTagsSorted = newTags.sort().join(",");

    // Also extract better location
    const newLocation = extractLocation(opp.description || "");
    const locationChanged = newLocation !== "See posting" && opp.location === "See posting";

    if (oldTags !== newTagsSorted || locationChanged) {
      const updates: Record<string, any> = { tags: newTags, updatedAt: new Date() };
      if (locationChanged) updates.location = newLocation;

      await col.updateOne({ _id: opp._id }, { $set: updates });
      updated++;

      if (updated <= 5 || updated % 20 === 0) {
        console.log(`  Updated: "${opp.title?.substring(0, 50)}" → [${newTags.slice(0, 4).join(", ")}]`);
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\nResults: ${updated} updated, ${unchanged} unchanged`);
  await client.close();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
