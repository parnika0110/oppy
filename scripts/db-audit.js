require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db(process.env.MONGODB_DB || 'oppy');
  const col = db.collection('opportunities');

  console.log('Total:', await col.countDocuments());
  console.log('Active:', await col.countDocuments({ lifecycleStatus: 'active' }));
  console.log('Closed:', await col.countDocuments({ lifecycleStatus: 'closed' }));
  console.log('Archived:', await col.countDocuments({ lifecycleStatus: 'archived' }));

  // Category breakdown
  const cats = await col.aggregate([{$group:{_id:'$category',count:{$sum:1}}}, {$sort:{count:-1}}]).toArray();
  console.log('\nCategories:');
  cats.forEach(c => console.log('  ' + c._id + ': ' + c.count));

  // Source breakdown
  const sources = await col.aggregate([{$group:{_id:'$sourcePlatform',count:{$sum:1}}}, {$sort:{count:-1}}]).toArray();
  console.log('\nSources:');
  sources.forEach(s => console.log('  ' + (s._id||'null') + ': ' + s.count));

  await c.close();
})();
