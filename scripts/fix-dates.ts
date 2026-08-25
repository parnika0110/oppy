/**
 * Migration: convert string date fields to BSON Date objects in MongoDB.
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

async function main() {
  const env = readFileSync(".env.local", "utf8");
  const uriLine = env.split("\n").find((l) => l.startsWith("MONGODB_URI="))!;
  const srvUri = uriLine.replace("MONGODB_URI=", "").trim();

  const directUri = srvUri.replace(
    /mongodb\+srv:\/\/([^@]+@)([^/?]+)(.*)/,
    "mongodb://$1ac-oc4gx0q-shard-00-00.6xgxw3w.mongodb.net:27017,ac-oc4gx0q-shard-00-01.6xgxw3w.mongodb.net:27017,ac-oc4gx0q-shard-00-02.6xgxw3w.mongodb.net:27017$3&authSource=admin&ssl=true"
  );

  const client = new MongoClient(directUri);
  await client.connect();
  const col = client.db("oppy").collection("opportunities");

  console.log("🔧 Finding docs with string deadlines...");

  const cursor = col.find({ deadline: { $type: "string" } });
  let fixed = 0;

  for await (const doc of cursor) {
    const update: Record<string, unknown> = {};
    if (typeof doc.deadline === "string") update.deadline = new Date(doc.deadline);
    if (typeof doc.firstSeenAt === "string") update.firstSeenAt = new Date(doc.firstSeenAt);
    if (typeof doc.lastSeenAt === "string") update.lastSeenAt = new Date(doc.lastSeenAt);
    if (typeof doc.createdAt === "string") update.createdAt = new Date(doc.createdAt);
    if (typeof doc.updatedAt === "string") update.updatedAt = new Date(doc.updatedAt);

    if (Object.keys(update).length > 0) {
      await col.updateOne({ _id: doc._id }, { $set: update });
      fixed++;
    }
  }

  console.log(`✅ Fixed ${fixed} documents — dates are now BSON Date objects.`);

  const nowCount = await col.countDocuments({ isActive: true, deadline: { $gte: new Date() } });
  console.log(`✅ Docs visible to API filter (isActive + deadline >= now): ${nowCount}`);

  await client.close();
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
