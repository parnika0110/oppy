/**
 * Migration script: MongoDB → Supabase
 *
 * Run with: node --env-file=.env.local --import tsx scripts/migrate-mongo-to-supabase.ts
 *
 * This script:
 * 1. Reads all opportunities from MongoDB
 * 2. Transforms them to match the Supabase schema
 * 3. Inserts them into Supabase
 * 4. Verifies counts match
 */

import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB || "oppy";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function mapCategory(cat: string): string {
  const valid = ["Job", "Internship", "Hackathon", "Fellowship", "Scholarship", "Grant", "Event"];
  return valid.includes(cat) ? cat : "Event";
}

function mapDeadlineKind(dk: string | null | undefined): string {
  const valid = ["verified", "source_provided", "rolling", "unavailable"];
  return dk && valid.includes(dk) ? dk : "unavailable";
}

function mapLifecycle(status: string | null | undefined): string {
  const valid = ["active", "closed", "archived"];
  return status && valid.includes(status) ? status : "active";
}

function mapDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

async function migrate() {
  console.log("=== MongoDB → Supabase Migration ===\n");

  // Connect to MongoDB
  const mongo = await MongoClient.connect(MONGODB_URI);
  const db = mongo.db(MONGODB_DB);
  const mongoOpps = db.collection("opportunities");

  const mongoTotal = await mongoOpps.countDocuments();
  console.log("MongoDB total opportunities:", mongoTotal);

  // Connect to Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Read all from MongoDB
  const allOpps = await mongoOpps.find({}).toArray();
  console.log("Read", allOpps.length, "records from MongoDB\n");

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Process in batches of 50
  for (let i = 0; i < allOpps.length; i += 50) {
    const batch = allOpps.slice(i, i + 50);

    for (const opp of batch) {
      const doc = {
        title: opp.title || "",
        organization: opp.organization || "",
        description: opp.description || "",
        category: mapCategory(opp.category),
        location: opp.location || "",
        is_remote: opp.isRemote || false,
        city: opp.city || null,
        country: opp.country || null,
        application_url: opp.applicationLink || opp.applicationUrl || null,
        source_url: opp.sourceUrl || null,
        event_url: opp.eventUrl || null,
        organizer_url: opp.organizerUrl || null,
        official_source_url: opp.officialSourceUrl || null,
        image_url: opp.imageUrl || null,
        image_alt: opp.imageAlt || null,
        application_deadline: mapDate(opp.deadline || opp.applicationDeadline),
        registration_deadline: mapDate(opp.registrationDeadline),
        event_start_date: mapDate(opp.eventDate),
        event_end_date: mapDate(opp.eventEndDate),
        deadline_kind: mapDeadlineKind(opp.deadlineKind),
        tags: opp.tags || [],
        quality_score: opp.qualityScore || null,
        opportunity_score: opp.opportunityScore || null,
        source: opp.source || null,
        source_platform: opp.sourcePlatform || null,
        source_id: opp.sourceId || null,
        discovery_method: opp.discoveryMethod || "unknown",
        discovery_query: opp.discoveryQuery || null,
        source_trust_tier: opp.sourceTrustTier || null,
        lifecycle_status: mapLifecycle(opp.lifecycleStatus),
        is_active: opp.isActive !== false,
        ai_summary: opp.aiSummary || null,
        category_validation: opp.categoryValidation || null,
        first_seen_at: mapDate(opp.firstSeenAt) || new Date().toISOString(),
        last_seen_at: mapDate(opp.lastSeenAt) || new Date().toISOString(),
        created_at: mapDate(opp.createdAt) || new Date().toISOString(),
        updated_at: mapDate(opp.updatedAt) || new Date().toISOString(),
      };

      // Try upsert by source_id + source_platform
      if (doc.source_id && doc.source_platform) {
        const { data: existing } = await supabase
          .from("opportunities")
          .select("id")
          .eq("source_id", doc.source_id)
          .eq("source_platform", doc.source_platform)
          .single();

        if (existing) {
          const { error } = await supabase
            .from("opportunities")
            .update(doc)
            .eq("id", existing.id);
          if (error) {
            errors++;
            if (errors <= 5) console.error("Update error:", error.message);
          } else {
            updated++;
          }
          continue;
        }
      }

      // Insert new
      const { error } = await supabase.from("opportunities").insert(doc);
      if (error) {
        errors++;
        if (errors <= 5) console.error("Insert error:", error.message, "|", doc.title?.substring(0, 40));
      } else {
        inserted++;
      }
    }

    // Progress
    const progress = Math.min(i + 50, allOpps.length);
    process.stdout.write(`\rProcessed ${progress}/${allOpps.length}...`);
  }

  console.log("\n\n=== Migration Results ===");
  console.log("Inserted:", inserted);
  console.log("Updated:", updated);
  console.log("Errors:", errors);

  // Verify
  const { count: supabaseCount } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true });

  console.log("\n=== Verification ===");
  console.log("MongoDB count:", mongoTotal);
  console.log("Supabase count:", supabaseCount);

  // Category comparison
  const mongoCategories = await mongoOpps.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const { data: supaCategories } = await supabase
    .from("opportunities")
    .select("category");

  const supaCatCounts: Record<string, number> = {};
  for (const row of supaCategories || []) {
    supaCatCounts[row.category] = (supaCatCounts[row.category] || 0) + 1;
  }

  console.log("\nCategory comparison:");
  for (const cat of mongoCategories) {
    const supaCount = supaCatCounts[cat._id] || 0;
    const match = supaCount === cat.count ? "✓" : "✗ MISMATCH";
    console.log(`  ${cat._id}: MongoDB=${cat.count} Supabase=${supaCount} ${match}`);
  }

  // Source comparison
  const mongoSources = await mongoOpps.aggregate([
    { $group: { _id: "$sourcePlatform", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const { data: supaSources } = await supabase
    .from("opportunities")
    .select("source_platform");

  const supaSrcCounts: Record<string, number> = {};
  for (const row of supaSources || []) {
    const key = row.source_platform || "null";
    supaSrcCounts[key] = (supaSrcCounts[key] || 0) + 1;
  }

  console.log("\nSource platform comparison:");
  for (const src of mongoSources) {
    const key = src._id || "null";
    const supaCount = supaSrcCounts[key] || 0;
    const match = supaCount === src.count ? "✓" : "✗ MISMATCH";
    console.log(`  ${key}: MongoDB=${src.count} Supabase=${supaCount} ${match}`);
  }

  // Lifecycle comparison
  const mongoLifecycle = await mongoOpps.aggregate([
    { $group: { _id: "$lifecycleStatus", count: { $sum: 1 } } },
  ]).toArray();

  const { data: supaLifecycle } = await supabase
    .from("opportunities")
    .select("lifecycle_status");

  const supaLifeCounts: Record<string, number> = {};
  for (const row of supaLifecycle || []) {
    supaLifeCounts[row.lifecycle_status] = (supaLifeCounts[row.lifecycle_status] || 0) + 1;
  }

  console.log("\nLifecycle comparison:");
  for (const lc of mongoLifecycle) {
    const key = lc._id || "null";
    const supaCount = supaLifeCounts[key] || 0;
    const match = supaCount === lc.count ? "✓" : "✗ MISMATCH";
    console.log(`  ${key}: MongoDB=${lc.count} Supabase=${supaCount} ${match}`);
  }

  await mongo.close();
  console.log("\nMigration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
