import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

// Parse .env.local manually
const env = readFileSync(".env.local", "utf8");
const uriLine = env.split("\n").find((l) => l.startsWith("MONGODB_URI="));
const srvUri = uriLine.replace("MONGODB_URI=", "").trim();

// Convert SRV to direct connection
const directUri = srvUri.replace(
  /mongodb\+srv:\/\/([^@]+@)([^/?]+)(.*)/,
  "mongodb://$1ac-oc4gx0q-shard-00-00.6xgxw3w.mongodb.net:27017,ac-oc4gx0q-shard-00-01.6xgxw3w.mongodb.net:27017,ac-oc4gx0q-shard-00-02.6xgxw3w.mongodb.net:27017$3&authSource=admin&ssl=true"
);

const client = new MongoClient(directUri);
await client.connect();
const col = client.db("oppy").collection("opportunities");

const total = await col.countDocuments();
const active = await col.countDocuments({ isActive: true });

// Check deadline type on first doc
const sample = await col.find({}).limit(5).project({ title: 1, isActive: 1, deadline: 1, _id: 0 }).toArray();
console.log(`Total: ${total}, isActive=true: ${active}`);
console.log("Sample docs:");
for (const doc of sample) {
  console.log(`  - "${doc.title}" | isActive=${doc.isActive} | deadline type=${typeof doc.deadline} | deadline=${doc.deadline}`);
}

// Test the actual filter the API uses
const now = new Date();
const apiFilter = { isActive: true, deadline: { $gte: now } };
const apiCount = await col.countDocuments(apiFilter);
console.log(`\nAPI filter result (isActive:true + deadline >= now): ${apiCount} docs`);

await client.close();
