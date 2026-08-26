import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runIngestionPipeline } from "../lib/ingestion/index";

async function run() {
  const result = await runIngestionPipeline();
  console.log(result);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
