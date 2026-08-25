import "dotenv/config";
import { getOpportunitiesCollection } from "../lib/mongodb";

/**
 * Reports or clears fabricated legacy deadlines from the static catalog without
 * deleting listings. The default is read-only; use --apply only after review.
 */
async function main() {
  const collection = await getOpportunitiesCollection();
  const filter = {
    sourceId: { $regex: "^static-" },
    $or: [
      { deadline: { $ne: null } },
      { deadlineKind: { $ne: "unavailable" } },
      { deadlineLastVerifiedAt: { $ne: null } },
    ],
  };
  const targets = await collection.find(filter, { projection: { _id: 1, title: 1, deadline: 1, deadlineKind: 1 } }).toArray();
  console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", matched: targets.length, changes: { deadline: null, deadlineKind: "unavailable", deadlineLastVerifiedAt: null }, records: targets.map(({ _id, title, deadline, deadlineKind }) => ({ id: _id.toString(), title, deadline, deadlineKind: deadlineKind || null })) }, null, 2));

  if (!process.argv.includes("--apply")) return;
  const result = await collection.updateMany(
    filter,
    {
      $set: {
        deadline: null,
        deadlineKind: "unavailable",
        deadlineLastVerifiedAt: null,
        updatedAt: new Date(),
      },
    }
  );

  console.log(`Updated ${result.modifiedCount} static opportunity records.`);
}

main().catch((error) => {
  console.error("Could not clear static deadlines:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
