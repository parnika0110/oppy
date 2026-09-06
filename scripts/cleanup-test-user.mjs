/**
 * Cleanup script for disposable test accounts.
 *
 * Usage:  node scripts/cleanup-test-user.mjs <email>
 *
 * Deletes ONLY the records belonging to the user with that exact email:
 *   - applicationTracking entries (matched by userId STRING — the same shape
 *     the app writes in POST /api/tracking)
 *   - saved opportunities
 *   - recently-viewed entries
 *   - sessions
 *   - the user document itself
 *
 * SAFETY CONTRACT (this is the whole point of the script):
 *   Every delete is scoped by the looked-up user's id. There is NO code path
 *   that deletes by opportunityId (or by any other non-user field), so running
 *   this can never touch another user's tracking record simply because they
 *   tracked the same opportunity. If the email does not resolve to a user, the
 *   script prints a message and exits WITHOUT deleting anything.
 */

import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/cleanup-test-user.mjs <email>");
    process.exit(2);
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "oppy";
  if (!uri) {
    console.error("MONGODB_URI is not set in the environment.");
    process.exit(2);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  try {
    const db = client.db(dbName);
    const users = db.collection("users");

    const user = await users.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      console.log(`No user found for "${email}" — nothing to delete.`);
      return;
    }

    // The app stores userId as a STRING in tracking entries (POST /api/tracking
    // writes `userId: user.id` where user.id = user._id.toString()).
    const userIdString = user._id.toString();
    const userIdObject = user._id;

    const [delTracking, delSaved, delViewed, delSessions, delUser] = await Promise.all([
      db.collection("applicationTracking").deleteMany({ userId: userIdString }),
      db.collection("savedOpportunities").deleteMany({ userId: userIdObject }),
      db.collection("recentlyViewed").deleteMany({ userId: userIdObject }),
      db.collection("sessions").deleteMany({ userId: userIdObject }),
      users.deleteOne({ _id: userIdObject }),
    ]);

    console.log(`Cleaned up "${email}" (${userIdString}):`);
    console.log(`  tracking entries deleted: ${delTracking.deletedCount}`);
    console.log(`  saved deleted:             ${delSaved.deletedCount}`);
    console.log(`  recently-viewed deleted:   ${delViewed.deletedCount}`);
    console.log(`  sessions deleted:          ${delSessions.deletedCount}`);
    console.log(`  user deleted:              ${delUser.deletedCount}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Cleanup failed:", err.message);
  process.exit(1);
});