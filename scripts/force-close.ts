import { getOpportunitiesCollection } from "../lib/mongodb";

async function run() {
  const c = await getOpportunitiesCollection();
  // Find one item
  const item = await c.findOne({});
  if (item) {
    console.log("Found item:", item.title);
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    
    // Update it to be definitively closed
    await c.updateOne(
      { _id: item._id },
      { 
        $set: { 
          deadline: pastDate, 
          deadlineKind: "verified",
          applicationDeadline: pastDate,
          lifecycleStatus: "closed"
        } 
      }
    );
    console.log("Successfully closed item:", item._id);
  } else {
    console.log("No items found");
  }
  process.exit(0);
}

run();
