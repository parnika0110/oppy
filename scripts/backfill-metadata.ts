/**
 * Safe backfill script for extracting structured metadata from existing
 * opportunity descriptions. Run once to fix legacy records.
 *
 * Usage: npx tsx scripts/backfill-metadata.ts [--dry-run]
 *
 * Safety rules:
 * - Only populates fields that are currently null/undefined
 * - Never overwrites existing verified structured data
 * - Uses precedence: verified > source > description > null
 * - Dry-run by default (pass --apply to actually write)
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
try {
  const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.substring(0, eq).trim();
    const val = trimmed.substring(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found */ }

import { MongoClient } from "mongodb";
import {
  extractStipendFromText,
  extractDurationFromText,
  extractStartDateFromText,
  extractDeadlineFromText,
  normalizeEmploymentType,
} from "../lib/backfill-metadata";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB || "oppy";
const DRY_RUN = !process.argv.includes("--apply");

interface BackfillResult {
  source: string;
  total: number;
  stipendBackfilled: number;
  durationBackfilled: number;
  startDateBackfilled: number;
  deadlineBackfilled: number;
  employmentTypeBackfilled: number;
}

async function backfill() {
  console.log(`\n=== Metadata Backfill ${DRY_RUN ? "(DRY RUN)" : "(APPLY)"} ===\n`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);
  const col = db.collection("opportunities");

  // Get all active opportunities
  const sources = await col.distinct("source", { isActive: true });
  const results: BackfillResult[] = [];

  for (const source of sources.sort()) {
    const result: BackfillResult = {
      source,
      total: 0,
      stipendBackfilled: 0,
      durationBackfilled: 0,
      startDateBackfilled: 0,
      deadlineBackfilled: 0,
      employmentTypeBackfilled: 0,
    };

    const cursor = col.find({
      source,
      isActive: true,
      $or: [
        { stipend: { $in: [null, ""] } },
        { duration: { $in: [null, ""] } },
      ],
    });

    for await (const opp of cursor) {
      result.total++;
      const desc = opp.description || "";
      const updates: Record<string, unknown> = {};

      // Only extract from description if the structured field is null
      if (!opp.stipend) {
        const stipend = extractStipendFromText(desc);
        if (stipend) {
          updates.stipend = stipend;
          result.stipendBackfilled++;
        }
      }

      if (!opp.duration) {
        const duration = extractDurationFromText(desc);
        if (duration) {
          updates.duration = duration;
          result.durationBackfilled++;
        }
      }

      // Only write if we found something to update
      if (Object.keys(updates).length > 0 && !DRY_RUN) {
        await col.updateOne(
          { _id: opp._id },
          { $set: { ...updates, updatedAt: new Date() } }
        );
      }
    }

    results.push(result);
  }

  // Print results
  console.log("Source                    | Total | Stipend | Duration | Start | Deadline | Type");
  console.log("--------------------------|-------|---------|----------|-------|----------|-----");
  let totalBackfilled = 0;
  for (const r of results) {
    const backfilled = r.stipendBackfilled + r.durationBackfilled + r.startDateBackfilled + r.deadlineBackfilled + r.employmentTypeBackfilled;
    if (backfilled > 0) {
      console.log(
        `${r.source.padEnd(25)} | ${String(r.total).padStart(5)} | ${String(r.stipendBackfilled).padStart(7)} | ${String(r.durationBackfilled).padStart(8)} | ${String(r.startDateBackfilled).padStart(5)} | ${String(r.deadlineBackfilled).padStart(8)} | ${r.employmentTypeBackfilled}`
      );
      totalBackfilled += backfilled;
    }
  }

  console.log(`\nTotal records processed: ${results.reduce((s, r) => s + r.total, 0)}`);
  console.log(`Total fields backfilled: ${totalBackfilled}`);
  console.log(DRY_RUN ? "\n(Dry run — no changes written. Use --apply to write.)" : "\n(Changes written to database.)");

  await client.close();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
