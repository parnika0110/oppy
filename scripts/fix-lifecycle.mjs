/**
 * Safe one-time migration: add lifecycleStatus:"active" to the 33 legacy records
 * that have isActive:true but NO lifecycleStatus field.
 *
 * SAFETY RULES:
 * - Only touches records where lifecycleStatus does NOT exist AND isActive=true
 * - Never touches archived records (they have lifecycleStatus:"archived")
 * - Never touches closed records
 * - Dry-run by default; pass --apply to actually write
 */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const apply = process.argv.includes('--apply');
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

async function main() {
  await client.connect();
  const db = client.db('oppy');
  const coll = db.collection('opportunities');

  // Find ONLY records without lifecycleStatus AND isActive=true
  const filter = {
    lifecycleStatus: { $exists: false },
    isActive: true,
  };

  const count = await coll.countDocuments(filter);
  console.log(`Found ${count} legacy active records without lifecycleStatus.`);

  if (count === 0) {
    console.log('Nothing to migrate.');
    await client.close();
    return;
  }

  // Preview
  const samples = await coll.find(filter).limit(5).project({ title: 1, organization: 1, isActive: 1 }).toArray();
  console.log('\nSample records to be updated:');
  samples.forEach(s => console.log(`  [${s._id}] ${s.title} — ${s.organization}`));

  if (!apply) {
    console.log('\nDRY RUN complete. Pass --apply to actually update.');
    await client.close();
    return;
  }

  const result = await coll.updateMany(filter, {
    $set: { lifecycleStatus: 'active', updatedAt: new Date() }
  });

  console.log(`\nUpdated ${result.modifiedCount} records with lifecycleStatus:"active".`);
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
