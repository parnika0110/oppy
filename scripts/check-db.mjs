import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

async function main() {
  await client.connect();
  const db = client.db('oppy');

  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const total = await db.collection('opportunities').countDocuments();
  const active = await db.collection('opportunities').countDocuments({ lifecycleStatus: 'active' });
  const closed = await db.collection('opportunities').countDocuments({ lifecycleStatus: 'closed' });
  const archived = await db.collection('opportunities').countDocuments({ lifecycleStatus: 'archived' });
  const legacyActive = await db.collection('opportunities').countDocuments({ lifecycleStatus: { $exists: false }, isActive: true });
  const noStatus = await db.collection('opportunities').countDocuments({ lifecycleStatus: { $exists: false } });
  const withImage = await db.collection('opportunities').countDocuments({ imageUrl: { $ne: null, $exists: true } });
  const candidates = await db.collection('discoveryCandidates').countDocuments().catch(() => 0);
  const sourceReg = await db.collection('sourceRegistry').countDocuments().catch(() => 0);

  console.log({ total, active, closed, archived, legacyActive, noStatus, withImage, candidates, sourceReg });

  // Sample active opps
  const samples = await db.collection('opportunities')
    .find({ $or: [{ lifecycleStatus: 'active' }, { lifecycleStatus: { $exists: false }, isActive: true }] })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  console.log('\n--- SAMPLE ACTIVE OPPORTUNITIES ---');
  samples.forEach(s => {
    console.log(JSON.stringify({
      id: s._id.toString(),
      title: s.title?.substring(0, 60),
      org: s.organization,
      status: s.lifecycleStatus,
      deadlineKind: s.deadlineKind,
      deadline: s.deadline,
      imageUrl: s.imageUrl ? s.imageUrl.substring(0, 50) + '...' : null,
      appLink: s.applicationLink?.substring(0, 70),
      sourcePlatform: s.sourcePlatform,
      category: s.category,
    }));
  });

  // Check candidates
  const pendingCandidates = await db.collection('discoveryCandidates')
    .find({ validationState: { $ne: 'rejected' } })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();

  console.log('\n--- CANDIDATE SAMPLES ---');
  pendingCandidates.forEach(c => {
    console.log(JSON.stringify({
      title: c.title?.substring(0, 60),
      org: c.organization,
      state: c.validationState,
      type: c.candidateType,
      url: c.url?.substring(0, 60),
    }));
  });

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
