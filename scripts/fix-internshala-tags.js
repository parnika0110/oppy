/**
 * Fix existing Internshala records in MongoDB by extracting role-specific tags
 * from their titles using the improved extractRoleTags logic.
 *
 * Run: node scripts/fix-internshala-tags.js
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'oppy';

// ── Tag extraction logic (mirrors lib/ingestion/sources/internshala.ts) ──

function extractRoleTags(title, baseTags) {
  const lower = title.toLowerCase();
  const tags = [];

  // AI / ML roles
  if (/\b(ai|machine learning|ml|deep learning|artificial intelligence|nlp|natural language|computer vision|data science|data analyst|analytics|llm|genai|generative)\b/.test(lower)) {
    tags.push("ai", "machine-learning", "python");
  }

  // Software Engineering roles
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

  // HR roles
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

  // Cybersecurity roles
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

async function main() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set in environment');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection('opportunities');

  // Find all Internshala records
  const internshalaRecords = await collection
    .find({ sourcePlatform: 'Internshala' })
    .toArray();

  console.log(`Found ${internshalaRecords.length} Internshala records`);

  let updated = 0;
  let unchanged = 0;
  const tagChanges = {};

  for (const opp of internshalaRecords) {
    // Generate new tags based on the title
    const newTags = extractRoleTags(opp.title, opp.tags || []);
    const oldTags = (opp.tags || []).sort().join(',');
    const newTagsSorted = newTags.sort().join(',');

    if (oldTags !== newTagsSorted) {
      await collection.updateOne(
        { _id: opp._id },
        { $set: { tags: newTags, updatedAt: new Date() } }
      );
      updated++;

      // Track what changed for the report
      const category = newTags.includes('marketing') ? 'Marketing'
        : newTags.includes('human-resources') ? 'HR'
        : newTags.includes('ai') ? 'AI/ML'
        : newTags.includes('software-engineering') ? 'Software Engineering'
        : newTags.includes('web-development') ? 'Web Development'
        : newTags.includes('design') ? 'Design'
        : newTags.includes('sales') ? 'Sales'
        : newTags.includes('finance') ? 'Finance'
        : newTags.includes('customer-service') ? 'Customer Service'
        : newTags.includes('cybersecurity') ? 'Cybersecurity'
        : newTags.includes('mobile') ? 'Mobile'
        : newTags.includes('devops') ? 'DevOps'
        : newTags.includes('content') ? 'Content'
        : newTags.includes('business') ? 'Business'
        : 'Other';

      tagChanges[category] = (tagChanges[category] || 0) + 1;

      if (updated <= 10 || updated % 10 === 0) {
        console.log(`  Updated: "${opp.title.substring(0, 50)}" → [${newTags.slice(0, 4).join(', ')}]`);
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`\nTag distribution after fix:`);
  for (const [cat, count] of Object.entries(tagChanges).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  await client.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
