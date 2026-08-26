import { getDb } from "@/lib/mongodb";
import { runDiscoveryPipeline } from "@/lib/discovery";

async function snapshot() {
  const db = await getDb();
  const [opportunities, active, archived, pendingCandidates] = await Promise.all([
    db.collection("opportunities").countDocuments({}),
    db.collection("opportunities").countDocuments({ $or: [{ lifecycleStatus: "active" }, { lifecycleStatus: { $exists: false }, isActive: true }] }),
    db.collection("opportunities").countDocuments({ lifecycleStatus: "archived" }),
    db.collection("discoveryCandidates").countDocuments({ validationState: { $in: ["pending", "needs_review"] } }),
  ]);
  return { opportunities, active, archived, pendingCandidates };
}

async function main() {
  const before = await snapshot();
  const result = await runDiscoveryPipeline();
  const after = await snapshot();
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), before, result, after, publicOpportunitiesChanged: after.opportunities - before.opportunities }, null, 2));
  if (after.opportunities !== before.opportunities) throw new Error("Safety check failed: discovery altered public opportunities.");
}

main().catch((error) => { console.error("Discovery run failed:", error instanceof Error ? error.message : error); process.exitCode = 1; });
