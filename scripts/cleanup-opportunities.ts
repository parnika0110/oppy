#!/usr/bin/env tsx
/**
 * Safe cleanup script for OPPY opportunity database.
 *
 * DEFAULT MODE: --dry-run (no changes made)
 * Use --execute to actually perform mutations.
 *
 * Usage:
 *   npx tsx scripts/cleanup-opportunities.ts --dry-run   (default, safe)
 *   npx tsx scripts/cleanup-opportunities.ts --execute    (actually modifies DB)
 */

import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "oppy";

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI environment variable is required.");
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--execute");

// ══════════════════════════════════════════════════════════════════════════════
// Records to DELETE — clearly not opportunities
// ══════════════════════════════════════════════════════════════════════════════

interface DeleteCandidate {
  id: string;
  title: string;
  source: string;
  category: string;
  expectedTitle?: string; // verify before mutating
  reason: string;
}

const DELETE_CANDIDATES: DeleteCandidate[] = [
  // ── GitHub Good First Issues (25) ──
  { id: "6a8c618399273e7eeb889317", title: "[Good First Issue] 🀄 Add new Learner Mistake 94", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618399273e7eeb889316", title: "[Good First Issue] 🌊 Add new Wallpaper URL #4", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618999273e7eeb889321", title: "[Good First Issue] 🌸 Add new Japan Fact 243", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabc65574f8704cda605b", title: "[Good First Issue] 🌸 Add new Trivia Question 119", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618999273e7eeb889322", title: "[Good First Issue] 🌺 Add new Community Note Line #2", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618399273e7eeb889318", title: "[Good First Issue] 🌺 Add new Example Sentence 57", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabc15574f8704cda6059", title: "[Good First Issue] 🍁 Add new Video Game Quote 101", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabc45574f8704cda605a", title: "[Good First Issue] 😔 Add new Anime Quote 77", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618599273e7eeb88931b", title: "[Good First Issue] 🍙 Add new Dialect Entry 27", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618a99273e7eeb889324", title: "[Good First Issue] 🍛 Add new False Friend Pair 42", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabbd5574f8704cda6057", title: "[Good First Issue] 🍣 Add new Dialect Entry 45", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabc95574f8704cda605c", title: "[Good First Issue] 🍣 Add new Japan Fact 261", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618499273e7eeb889319", title: "[Good First Issue] 🍥 Add new Etiquette Tip 99", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618699273e7eeb88931c", title: "[Good First Issue] 🍥 Add new Japanese Idiom 78", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618799273e7eeb88931e", title: "[Good First Issue] 🍱 Add new Anime Quote 69", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618699273e7eeb88931d", title: "[Good First Issue] 🍱 Add new Video Game Quote 95", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabb95574f8704cda6056", title: "[Good First Issue] 🎋 Add new Etiquette Tip 21", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618799273e7eeb88931f", title: "[Good First Issue] 🎌 Add new Grammar Point 43", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618a99273e7eeb889323", title: "[Good First Issue] 🎏 Add new Wallpaper URL #2", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabcb5574f8704cda605d", title: "[Good First Issue] 🏮 Add new Community Note Line #3", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618499273e7eeb88931a", title: "[Good First Issue] 🏮 Add new False Friend Pair 67", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8cabbf5574f8704cda6058", title: "[Good First Issue] 🏮 Add new Japanese Idiom 97", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c618899273e7eeb889320", title: "[Good First Issue] 🐉 Add new Japanese Proverb 10", source: "GitHub", category: "Hackathon", reason: "Good First Issue — not an opportunity" },
  { id: "6a8c619499273e7eeb889338", title: "[Good first issue] Add Portuguese contributor quickstart", source: "GitHub", category: "Internship", reason: "Good First Issue — not an opportunity" },

  // ── GitHub ZAP Security Scans (9) ──
  { id: "6a8c618d99273e7eeb88932a", title: "ZAP Baseline Scan", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c619199273e7eeb889333", title: "ZAP DAST 취약점 발견", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c63da40ea36b9bb4d98e5", title: "ZAP Full Scan Report", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c618e99273e7eeb88932c", title: "ZAP Scan Baseline Report", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c618e99273e7eeb88932b", title: "ZAP Scan Baseline Report", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c619199273e7eeb889331", title: "ZAP Scan Baseline Report", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c619099273e7eeb88932f", title: "ZAP Scan Baseline Report", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c619099273e7eeb889330", title: "ZAP Scan Baseline Report", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },
  { id: "6a8c618f99273e7eeb88932d", title: "ZAP baseline scan findings", source: "GitHub", category: "Fellowship", reason: "ZAP security scan — not an opportunity" },

  // ── GitHub Workflow/CI/Fixes (7) ──
  { id: "6a8c619399273e7eeb889337", title: "Fix Missing Semicolon in student.c", source: "GitHub", category: "Internship", reason: "Code fix — not an opportunity" },
  { id: "6a8c619499273e7eeb889339", title: "Fix and Improve Developer Account Linking", source: "GitHub", category: "Internship", reason: "Code fix — not an opportunity" },
  { id: "6a8c618b99273e7eeb889325", title: "Fix release publishing permission in build-modules workflow", source: "GitHub", category: "Fellowship", reason: "Workflow fix — not an opportunity" },
  { id: "6a8c618d99273e7eeb889329", title: "Fix: Harden pull request automation", source: "GitHub", category: "Fellowship", reason: "Security hardening — not an opportunity" },
  { id: "6a8c618c99273e7eeb889327", title: "Gate merges on Kani, unblock kani-full", source: "GitHub", category: "Fellowship", reason: "CI/workflow — not an opportunity" },
  { id: "6a8c619599273e7eeb88933b", title: "Guidelines", source: "GitHub", category: "Internship", reason: "Guidelines doc — not an opportunity" },

  // ── GitHub Feature/Enhancement/Docs (7) ──
  { id: "6a8c619699273e7eeb88933e", title: "Improve README Documentation", source: "GitHub", category: "Internship", reason: "Documentation — not an opportunity" },
  { id: "6a8c619699273e7eeb88933d", title: "docs: Improve project documentation", source: "GitHub", category: "Internship", reason: "Documentation — not an opportunity" },
  { id: "6a8c618c99273e7eeb889328", title: "docs: refine Kimi feature and sponsor layout", source: "GitHub", category: "Fellowship", reason: "Documentation — not an opportunity" },
  { id: "6a8c619399273e7eeb889336", title: "[Enhancement]: Add New Resources", source: "GitHub", category: "Internship", reason: "Feature request — not an opportunity" },
  { id: "6a8c619299273e7eeb889335", title: "[Enhancement]: Create a New Poster", source: "GitHub", category: "Internship", reason: "Feature request — not an opportunity" },
  { id: "6a8cabce5574f8704cda605e", title: "feat(pwa): Offline study logging", source: "GitHub", category: "Hackathon", reason: "Feature commit — not an opportunity" },
  { id: "6a8cabd05574f8704cda605f", title: "perf: Lazy load heavy third-party libraries", source: "GitHub", category: "Hackathon", reason: "Performance commit — not an opportunity" },

  // ── GitHub Other non-opportunity (10) ──
  { id: "6a8c619799273e7eeb88933f", title: "Automated project completion tracking", source: "GitHub", category: "Internship", reason: "Automation/CI — not an opportunity" },
  { id: "6a8cabd55574f8704cda6061", title: "Category request: agent-native programming languages", source: "GitHub", category: "Fellowship", reason: "Category request issue — not an opportunity" },
  { id: "6a8c618b99273e7eeb889326", title: "Get does not parse line continuation character", source: "GitHub", category: "Fellowship", reason: "Bug report — not an opportunity" },
  { id: "6a8c619899273e7eeb889341", title: "Increase the maximum value limit", source: "GitHub", category: "Internship", reason: "Feature request — not an opportunity" },
  { id: "6a8c619899273e7eeb889342", title: "Normalize Windows paths in export()", source: "GitHub", category: "Internship", reason: "Bug fix — not an opportunity" },
  { id: "6a8c619599273e7eeb88933a", title: "Single landing page for Chadbox Engine", source: "GitHub", category: "Internship", reason: "Feature request — not an opportunity" },
  { id: "6a8cabd75574f8704cda6062", title: "SubGraph.process raises NameError", source: "GitHub", category: "Fellowship", reason: "Bug report — not an opportunity" },
  { id: "6a8c619299273e7eeb889334", title: "[FEAT]: End-to-End Synthetic Data Generator", source: "GitHub", category: "Internship", reason: "Feature request — not an opportunity" },
  { id: "6a8c619199273e7eeb889332", title: "[Feature]: Windows 10 support", source: "GitHub", category: "Fellowship", reason: "Feature request — not an opportunity" },
  { id: "6a8cabd35574f8704cda6060", title: "Portfolio archaeology batch 1", source: "GitHub", category: "Fellowship", reason: "Portfolio PR — not an opportunity" },
  { id: "6a8c618f99273e7eeb88932e", title: "Add prodigyfi V2 adapter", source: "GitHub", category: "Fellowship", reason: "DeFi adapter PR — not an opportunity" },
  { id: "6a8c619699273e7eeb88933c", title: "Prepare to enroll as a trainee", source: "GitHub", category: "Internship", reason: "Coursework issue — not an opportunity" },
  { id: "6a8c619799273e7eeb889340", title: "Run the first real-world Axoloth onboarding usability test", source: "GitHub", category: "Internship", reason: "Internal test task — not an opportunity" },

  // ── RSS News articles (2) ──
  { id: "6a8ff8957fc732ebea635f47", title: "Self-driving truck startup Gatik raises $200M following PepsiCo deal", source: "RSS", category: "Grant", reason: "News article about funding — not an opportunity" },
  { id: "6a8ff8947fc732ebea635f46", title: "Harshita Arora Joins YC as General Partner", source: "RSS", category: "Fellowship", reason: "News article — not an opportunity" },
];

// ══════════════════════════════════════════════════════════════════════════════
// Records to RECLASSIFY — correct category
// ══════════════════════════════════════════════════════════════════════════════

interface ReclassifyCandidate {
  id: string;
  title: string;
  currentCategory: string;
  newCategory: string;
  expectedTitle?: string;
  reason: string;
}

const RECLASSIFY_CANDIDATES: ReclassifyCandidate[] = [
  {
    id: "6a8cb4735574f8704cda606a",
    title: "Hertz Foundation Graduate Fellowship",
    currentCategory: "Grant",
    newCategory: "Fellowship",
    reason: "Hertz Foundation Graduate Fellowship → Fellowship",
  },
  {
    id: "6a8cb4745574f8704cda606b",
    title: "Ford Foundation Fellowship Program",
    currentCategory: "Grant",
    newCategory: "Fellowship",
    reason: "Ford Foundation Fellowship Program → Fellowship",
  },
  {
    id: "6a8cb4735574f8704cda6069",
    title: "Palantir Path Scholarship",
    currentCategory: "Grant",
    newCategory: "Scholarship",
    reason: "Palantir Path Scholarship → Scholarship",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Execution
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  const mode = DRY_RUN ? "DRY RUN" : "EXECUTE";
  console.log(`\n═══ OPPY Database Cleanup — ${mode} ═══\n`);

  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db(MONGODB_DB);
  const col = db.collection("opportunities");

  // ── DELETES ──
  let deleteCount = 0;
  let deleteSkipped = 0;

  console.log(`\n── DELETE CANDIDATES: ${DELETE_CANDIDATES.length} records ──\n`);

  for (const candidate of DELETE_CANDIDATES) {
    const oid = new ObjectId(candidate.id);
    const doc = await col.findOne({ _id: oid });

    if (!doc) {
      console.log(`  SKIP [${candidate.id}] — not found in database`);
      deleteSkipped++;
      continue;
    }

    const docTitle = (doc.title || "").substring(0, 60);
    const docSource = doc.source || "";
    const docCategory = doc.category || "";

    // Safety: verify title and source match expectations
    const titleMatch = candidate.title
      .split(" ")
      .slice(0, 3)
      .every((w) => docTitle.toLowerCase().includes(w.toLowerCase()));
    const sourceMatch = docSource === candidate.source;

    if (!titleMatch || !sourceMatch) {
      console.log(`  SKIP [${candidate.id}] — record changed since audit`);
      console.log(`    expected: title~"${candidate.title.substring(0, 40)}" source=${candidate.source}`);
      console.log(`    actual:   title="${docTitle}" source=${docSource}`);
      deleteSkipped++;
      continue;
    }

    console.log(`  DELETE [${candidate.id}]`);
    console.log(`    title: "${docTitle}"`);
    console.log(`    source: ${docSource} | category: ${docCategory}`);
    console.log(`    reason: ${candidate.reason}`);

    if (!DRY_RUN) {
      await col.deleteOne({ _id: oid });
      console.log(`    → DELETED`);
    } else {
      console.log(`    → would delete (dry run)`);
    }
    deleteCount++;
  }

  // ── RECLASSIFICATIONS ──
  let reclassifyCount = 0;
  let reclassifySkipped = 0;

  console.log(`\n── RECLASSIFY CANDIDATES: ${RECLASSIFY_CANDIDATES.length} records ──\n`);

  for (const candidate of RECLASSIFY_CANDIDATES) {
    const oid = new ObjectId(candidate.id);
    const doc = await col.findOne({ _id: oid });

    if (!doc) {
      console.log(`  SKIP [${candidate.id}] — not found in database`);
      reclassifySkipped++;
      continue;
    }

    const docTitle = (doc.title || "").substring(0, 60);
    const docCategory = doc.category || "";

    if (docCategory === candidate.newCategory) {
      console.log(`  SKIP [${candidate.id}] — already ${candidate.newCategory}`);
      reclassifySkipped++;
      continue;
    }

    if (docCategory !== candidate.currentCategory) {
      console.log(`  SKIP [${candidate.id}] — category changed since audit`);
      console.log(`    expected: ${candidate.currentCategory} | actual: ${docCategory}`);
      reclassifySkipped++;
      continue;
    }

    console.log(`  RECLASSIFY [${candidate.id}]`);
    console.log(`    title: "${docTitle}"`);
    console.log(`    category: ${candidate.currentCategory} → ${candidate.newCategory}`);
    console.log(`    reason: ${candidate.reason}`);

    if (!DRY_RUN) {
      await col.updateOne({ _id: oid }, { $set: { category: candidate.newCategory, updatedAt: new Date() } });
      console.log(`    → UPDATED`);
    } else {
      console.log(`    → would update (dry run)`);
    }
    reclassifyCount++;
  }

  // ── SUMMARY ──
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  MODE:            ${mode}`);
  console.log(`  DELETIONS:       ${deleteCount} processed, ${deleteSkipped} skipped`);
  console.log(`  RECLASSIFICATIONS: ${reclassifyCount} processed, ${reclassifySkipped} skipped`);
  console.log(`  TOTAL CHANGES:   ${deleteCount + reclassifyCount}`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);

  if (DRY_RUN) {
    console.log(`To execute changes, run with --execute flag:`);
    console.log(`  npx tsx scripts/cleanup-opportunities.ts --execute\n`);
  }

  await client.close();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
