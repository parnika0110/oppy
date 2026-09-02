/**
 * OPPY Opportunity Database Audit Script
 *
 * Run: npx tsx scripts/audit-opportunities.ts
 *
 * This script analyzes the opportunities collection for:
 * - News/editorial content incorrectly ingested as opportunities
 * - Category mismatches
 * - Duplicates
 * - Data quality issues
 *
 * DRY RUN ONLY — does not modify any data.
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "oppy";

// ── Patterns indicating non-opportunity content ──────────────────────────

const NEWS_PATTERNS = [
  /\b(raises?\s+\$|raised\s+\$|funding\s+round|series\s+[a-z]|valuation|investor|venture\s+capital|backed\s+by)\b/i,
  /\b(acquires?|acquisition|acquired\s+by|merger|merged)\b/i,
  /\b(launches?|launched|product\s+launch|unveils?|unveiled)\b/i,
  /\b(revenue|profit|loss|earnings|ipo|public\s+offering)\b/i,
  /\b(deal|partnership|partnered|collaboration)\b/i,
  /\b(report|reports|reported|according\s+to|analysis|analyst|study\s+shows|survey|findings|insights)\b/i,
  /\b(opinion|editorial|commentary|perspective|thoughts\s+on|my\s+take|i\s+think|lessons?\s+learned)\b/i,
  /\b(tutorial|how\s+to|guide|step\s+by\s+step|walkthrough|getting\s+started|introduction\s+to|101|explained|deep\s+dive)\b/i,
];

const OPPORTUNITY_SIGNALS = [
  /\b(apply|application|register|registration|submit|enroll)\b/i,
  /\b(deadline|closing\s+date|due\s+date|apply\s+by|submit\s+by|expires?)\b/i,
  /\b(eligible|eligibility|requirements|qualifications|who\s+can\s+apply|applicants?)\b/i,
  /\b(now\s+accepting|we're\s+hiring|open\s+for|looking\s+for|accepting\s+applications)\b/i,
  /\b(intern|internship|fellow|fellowship|scholarship|grant|hackathon|competition)\b/i,
];

function isLikelyNews(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  const hasNewsSignal = NEWS_PATTERNS.some((p) => p.test(combined));
  const hasOpportunitySignal = OPPORTUNITY_SIGNALS.some((p) => p.test(combined));
  return hasNewsSignal && !hasOpportunitySignal;
}

function hasOpportunitySignals(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  return OPPORTUNITY_SIGNALS.some((p) => p.test(combined));
}

// ── Category mismatch detection ──────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, RegExp[]> = {
  Fellowship: [/\b(fellow|fellowship)\b/i],
  Scholarship: [/\b(scholarship)\b/i],
  Grant: [/\b(grant|grants|funding\s+opportunity|stipend)\b/i],
  Internship: [/\b(intern|internship|co-?op)\b/i],
  Hackathon: [/\b(hackathon|hack|competition|contest)\b/i],
  Event: [/\b(conference|meetup|workshop|webinar|summit|event)\b/i],
  Job: [/\b(hiring|job|position|vacancy|career)\b/i],
};

function detectCategoryFromContent(title: string, description: string): string | null {
  const combined = `${title} ${description}`.toLowerCase();
  for (const [cat, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
    if (patterns.some((p) => p.test(combined))) return cat;
  }
  return null;
}

// ── Main audit ───────────────────────────────────────────────────────────

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set. Run: MONGODB_URI=... npx tsx scripts/audit-opportunities.ts");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);
  const opps = db.collection("opportunities");

  const total = await opps.countDocuments();
  console.log(`\n═══ OPPY Database Audit ═══\n`);
  console.log(`Total opportunities: ${total}\n`);

  // ── Source breakdown ─────────────────────────────────────────────────
  const sourcePipeline = [
    { $group: { _id: "$source", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ];
  const sourceResults = await opps.aggregate(sourcePipeline).toArray();
  console.log("SOURCE BREAKDOWN:");
  console.log("─".repeat(50));
  for (const s of sourceResults) {
    console.log(`  ${(s._id || "unknown").padEnd(25)} ${s.count}`);
  }

  // ── Category breakdown ───────────────────────────────────────────────
  const catPipeline = [
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ];
  const catResults = await opps.aggregate(catPipeline).toArray();
  console.log("\nCATEGORY BREAKDOWN:");
  console.log("─".repeat(50));
  for (const c of catResults) {
    console.log(`  ${(c._id || "unknown").padEnd(25)} ${c.count}`);
  }

  // ── RSS-sourced records analysis ─────────────────────────────────────
  const rssRecords = await opps.find({ source: "RSS" }).toArray();
  console.log(`\nRSS-SOURCED RECORDS: ${rssRecords.length}`);
  console.log("─".repeat(50));

  let rssNews = 0;
  let rssOpportunity = 0;
  let rssAmbiguous = 0;
  const rssNewsExamples: string[] = [];
  const rssCatMismatches: string[] = [];

  for (const record of rssRecords) {
    const title = record.title || "";
    const desc = record.description || "";
    const category = record.category || "";

    if (isLikelyNews(title, desc)) {
      rssNews++;
      if (rssNewsExamples.length < 10) {
        rssNewsExamples.push(`  [${category}] ${title.substring(0, 80)}`);
      }
    } else if (hasOpportunitySignals(title, desc)) {
      rssOpportunity++;
      // Check category mismatch
      const detected = detectCategoryFromContent(title, desc);
      if (detected && detected !== category && rssCatMismatches.length < 10) {
        rssCatMismatches.push(`  [stored: ${category}] [detected: ${detected}] ${title.substring(0, 60)}`);
      }
    } else {
      rssAmbiguous++;
    }
  }

  console.log(`  Likely news/editorial: ${rssNews}`);
  console.log(`  Likely opportunity:    ${rssOpportunity}`);
  console.log(`  Ambiguous:             ${rssAmbiguous}`);

  if (rssNewsExamples.length > 0) {
    console.log("\n  NEWS EXAMPLES:");
    for (const ex of rssNewsExamples) console.log(ex);
  }

  if (rssCatMismatches.length > 0) {
    console.log("\n  CATEGORY MISMATCHES (RSS):");
    for (const m of rssCatMismatches) console.log(m);
  }

  // ── Category mismatch analysis (all sources) ─────────────────────────
  console.log("\nCATEGORY MISMATCH ANALYSIS (all sources):");
  console.log("─".repeat(50));

  let totalMismatches = 0;
  const mismatchExamples: string[] = [];

  // Sample up to 5000 records for mismatch analysis
  const sampleSize = Math.min(total, 5000);
  const sample = await opps.find({}).limit(sampleSize).toArray();

  for (const record of sample) {
    const title = record.title || "";
    const desc = record.description || "";
    const category = record.category || "";
    const detected = detectCategoryFromContent(title, desc);

    if (detected && detected !== category) {
      totalMismatches++;
      if (mismatchExamples.length < 15) {
        mismatchExamples.push(`  [stored: ${category}] [detected: ${detected}] ${title.substring(0, 70)}`);
      }
    }
  }

  console.log(`  Sampled: ${sampleSize} records`);
  console.log(`  Mismatches found: ${totalMismatches}`);
  if (mismatchExamples.length > 0) {
    console.log("\n  EXAMPLES:");
    for (const ex of mismatchExamples) console.log(ex);
  }

  // ── Data quality issues ──────────────────────────────────────────────
  console.log("\nDATA QUALITY:");
  console.log("─".repeat(50));

  const missingTitle = await opps.countDocuments({ $or: [{ title: null }, { title: "" }, { title: { $exists: false } }] });
  const missingUrl = await opps.countDocuments({ $or: [{ applicationLink: null }, { applicationLink: "" }, { applicationLink: { $exists: false } }] });
  const missingCategory = await opps.countDocuments({ $or: [{ category: null }, { category: "" }, { category: { $exists: false } }] });
  const expired = await opps.countDocuments({ lifecycleStatus: "closed" });

  console.log(`  Missing title:      ${missingTitle}`);
  console.log(`  Missing URL:        ${missingUrl}`);
  console.log(`  Missing category:   ${missingCategory}`);
  console.log(`  Expired (closed):   ${expired}`);

  // ── Duplicate analysis ───────────────────────────────────────────────
  console.log("\nDUPLICATE ANALYSIS:");
  console.log("─".repeat(50));

  const dupePipeline = [
    { $group: { _id: "$sourceUrl", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ];
  const dupes = await opps.aggregate(dupePipeline).toArray();
  console.log(`  URL-based duplicates: ${dupes.length} groups`);
  if (dupes.length > 0) {
    for (const d of dupes.slice(0, 5)) {
      console.log(`    ${d.count}x: ${(d._id || "null").substring(0, 60)}`);
    }
  }

  // ── Title+org duplicates ─────────────────────────────────────────────
  const titleDupePipeline = [
    { $group: { _id: { title: { $toLower: "$title" }, org: { $toLower: "$organization" } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ];
  const titleDupes = await opps.aggregate(titleDupePipeline).toArray();
  console.log(`  Title+org duplicates: ${titleDupes.length} groups`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log("\n═══ SUMMARY ═══");
  console.log(`Total records:           ${total}`);
  console.log(`RSS news/editorial:      ${rssNews} (proposal: remove)`);
  console.log(`RSS ambiguous:           ${rssAmbiguous} (review needed)`);
  console.log(`Category mismatches:     ${totalMismatches} (of ${sampleSize} sampled)`);
  console.log(`URL duplicates:          ${dupes.length} groups`);
  console.log(`Title+org duplicates:    ${titleDupes.length} groups`);
  console.log(`Missing fields:          title=${missingTitle} url=${missingUrl} category=${missingCategory}`);
  console.log(`Expired records:         ${expired}`);

  await client.close();
  console.log("\nAudit complete. No data was modified.\n");
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
