import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

async function main() {
  const { runIngestionPipeline } = await import("../lib/ingestion/index.js");
  console.log('Running ingestion pipeline...');
  try {
    const result = await runIngestionPipeline();
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Failed:', err);
  }
  process.exit(0);
}

main();
