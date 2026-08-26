import { getOpportunitiesCollection } from '../lib/mongodb';
import { runIngestionPipeline } from '../lib/ingestion/index';

async function reset() {
  const c = await getOpportunitiesCollection();
  
  // 1. Delete all mocks from job boards so we can ingest fresh ones with correct images
  console.log("Deleting old job board mocks...");
  await c.deleteMany({ sourcePlatform: { $in: ["LinkedIn", "Naukri"] } });

  // 2. Add a definitively closed event to prove the checkbox works
  console.log("Inserting a closed event...");
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);
  
  await c.updateOne(
    { sourceId: "mock-closed-event" },
    {
      $set: {
        title: "Past Hackathon (Closed)",
        organization: "Tech Club",
        category: "Hackathon",
        location: "Remote",
        description: "This hackathon has already ended.",
        applicationLink: "https://example.com/closed",
        imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=400&h=400",
        deadline: pastDate,
        deadlineKind: "verified",
        sourcePlatform: "Other",
        sourceId: "mock-closed-event",
        lifecycleStatus: "active",
        createdAt: new Date("2023-01-01"),
        qualityScore: 90,
        opportunityScore: 90
      }
    },
    { upsert: true }
  );

  // 3. Re-run ingestion to pull the fresh job board mocks
  console.log("Re-running ingestion pipeline...");
  await runIngestionPipeline();
  
  console.log("Done!");
  process.exit(0);
}

reset().catch(console.error);
