import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

/**
 * One-time migration to fix data quality issues:
 * 1. Fix sourcePlatform for existing records ("Other" → correct platform)
 * 2. Set deadlineKind to "rolling" for static program records with no deadline
 * 3. Remove verbose console noise
 */
async function main() {
  await client.connect();
  const db = client.db('oppy');
  const collection = db.collection('opportunities');

  console.log('=== OPPY Data Quality Migration ===\n');

  // ── Fix sourcePlatform ────────────────────────────────────────────────
  const platformFixes = [
    { filter: { organization: 'Google', sourcePlatform: 'Other' }, update: { sourcePlatform: 'Google' } },
    { filter: { organization: 'Microsoft', sourcePlatform: 'Other' }, update: { sourcePlatform: 'Microsoft' } },
    { filter: { organization: { $regex: /^Amazon/i }, sourcePlatform: 'Other' }, update: { sourcePlatform: 'AWS' } },
    { filter: { organization: 'GitHub', sourcePlatform: 'Other' }, update: { sourcePlatform: 'GitHub' } },
    { filter: { organization: 'Y Combinator', sourcePlatform: 'Other' }, update: { sourcePlatform: 'YCombinator' } },
    { filter: { organization: 'Major League Hacking', sourcePlatform: 'Other' }, update: { sourcePlatform: 'Other' } }, // MLH stays Other — it's not its own platform brand
    { filter: { organization: 'Software Freedom Conservancy', sourcePlatform: 'Other' }, update: { sourcePlatform: 'Other' } }, // Outreachy
    { filter: { organization: 'Palantir', sourcePlatform: 'Other' }, update: { sourcePlatform: 'Other' } },
    { filter: { organization: 'Meta', sourcePlatform: 'Other' }, update: { sourcePlatform: 'Other' } },
  ];

  let totalPlatformFixed = 0;
  for (const fix of platformFixes) {
    const result = await collection.updateMany(fix.filter, { $set: { ...fix.update, updatedAt: new Date() } });
    if (result.modifiedCount > 0) {
      console.log(`  ✓ Fixed ${result.modifiedCount} records: ${JSON.stringify(fix.filter.organization)} → sourcePlatform: "${fix.update.sourcePlatform}"`);
      totalPlatformFixed += result.modifiedCount;
    }
  }
  console.log(`  Total platform fixes: ${totalPlatformFixed}\n`);

  // ── Fix deadlineKind for rolling programs ─────────────────────────────
  // Static programs with no deadline should be "rolling" not "unavailable"
  const rollingResult = await collection.updateMany(
    {
      deadline: null,
      deadlineKind: 'unavailable',
      sourceId: { $regex: /^static-/ },
    },
    { $set: { deadlineKind: 'rolling', updatedAt: new Date() } }
  );
  console.log(`  ✓ Set ${rollingResult.modifiedCount} static programs to deadlineKind: "rolling"\n`);

  // Also set rolling for well-known always-open programs even without "static-" prefix
  const rollingByTitle = await collection.updateMany(
    {
      deadline: null,
      deadlineKind: 'unavailable',
      title: { $in: [
        'Google Summer of Code',
        'Outreachy Internships',
        'MLH Fellowship',
        'GitHub Campus Experts Program',
        'Microsoft Learn Student Ambassadors',
        'Google Developer Student Clubs Lead',
        'Y Combinator Startup School',
        'AWS Activate for Startups',
      ]},
    },
    { $set: { deadlineKind: 'rolling', updatedAt: new Date() } }
  );
  console.log(`  ✓ Set ${rollingByTitle.modifiedCount} more programs to deadlineKind: "rolling" (by title)\n`);

  // ── Ensure all records have lifecycleStatus ──────────────────────────
  const noStatus = await collection.updateMany(
    { lifecycleStatus: { $exists: false }, isActive: true },
    { $set: { lifecycleStatus: 'active' } }
  );
  console.log(`  ✓ Set lifecycleStatus: "active" on ${noStatus.modifiedCount} legacy records\n`);

  const noStatusInactive = await collection.updateMany(
    { lifecycleStatus: { $exists: false }, isActive: false },
    { $set: { lifecycleStatus: 'archived' } }
  );
  console.log(`  ✓ Set lifecycleStatus: "archived" on ${noStatusInactive.modifiedCount} legacy inactive records\n`);

  // ── Summary ──────────────────────────────────────────────────────────
  const total = await collection.countDocuments();
  const active = await collection.countDocuments({ lifecycleStatus: 'active' });
  const closed = await collection.countDocuments({ lifecycleStatus: 'closed' });
  const archived = await collection.countDocuments({ lifecycleStatus: 'archived' });
  const withImage = await collection.countDocuments({ imageUrl: { $ne: null, $exists: true } });
  const withDeadline = await collection.countDocuments({ deadline: { $ne: null } });
  const rolling = await collection.countDocuments({ deadlineKind: 'rolling' });

  console.log('=== Post-Migration Stats ===');
  console.log({ total, active, closed, archived, withImage, withDeadline, rolling });

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
