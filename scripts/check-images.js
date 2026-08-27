require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db(process.env.MONGODB_DB || 'oppy');
  const col = db.collection('opportunities');

  const withImg = await col.countDocuments({ imageUrl: { $exists: true, $ne: null, $ne: '' } });
  const withoutImg = await col.countDocuments({ $or: [{ imageUrl: { $exists: false } }, { imageUrl: null }, { imageUrl: '' }] });
  console.log('With imageUrl:', withImg);
  console.log('Without imageUrl:', withoutImg);

  const samples = await col.find({ imageUrl: { $exists: true, $ne: null, $ne: '' } }).limit(15).toArray();
  console.log('\nSample image URLs:');
  samples.forEach(s => console.log('  [' + s.sourcePlatform + '] ' + (s.imageUrl || 'null').substring(0, 120)));

  const hnUrls = await col.countDocuments({ imageUrl: { $regex: 'news.ycombinator.com' } });
  const nullish = await col.countDocuments({ $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }] });

  console.log('\nImage quality summary:');
  console.log('  HN page URLs as images:', hnUrls);
  console.log('  Null/empty:', nullish);
  console.log('  Total with image:', withImg);

  await c.close();
})();
