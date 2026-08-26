import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";

async function run() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("oppy");
  const collection = db.collection("opportunities");

  const opportunities = await collection.find({}).toArray();
  console.log(`Found ${opportunities.length} opportunities.`);

  let updatedCount = 0;
  
  // Random base date starting from 30 days ago
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30);

  for (const opp of opportunities) {
    // Generate a random date between 30 days ago and now
    const randomOffsetMs = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
    const newCreatedAt = new Date(baseDate.getTime() + randomOffsetMs);
    
    // Generate random scores between 65 and 98
    const opScore = Math.floor(Math.random() * (98 - 65 + 1)) + 65;
    const qScore = Math.floor(Math.random() * (98 - 65 + 1)) + 65;

    await collection.updateOne(
      { _id: opp._id },
      { 
        $set: { 
          createdAt: newCreatedAt,
          opportunityScore: opp.opportunityScore || opScore,
          qualityScore: opp.qualityScore || qScore,
        } 
      }
    );
    updatedCount++;
  }

  console.log(`Updated ${updatedCount} opportunities with random createdAt and scores.`);
  await client.close();
}

run().catch(console.error);
