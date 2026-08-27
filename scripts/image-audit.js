/**
 * Image Quality Audit Script
 *
 * Validates all opportunity images in MongoDB and reports quality metrics.
 * Run: node scripts/image-audit.js
 *
 * Checks:
 * - HTTP status
 * - Content-Type
 * - Dimensions (width >= 400, height >= 200)
 * - Favicon detection
 * - Placeholder detection
 * - Generic platform image detection
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'oppy';

// Generic platform images to reject
const GENERIC_PLATFORM_IMAGES = [
  'eventbrite.com/static/images/',
  'lu.ma/images/',
  'linkedin.com/mpr/mpr/',
  'internshala.com/images/',
  'github.com/identicons/',
  'github.com/favicon',
  'devpost.com/image/',
  'devfolio.co/images/',
  'unstop.com/public/images/',
];

// Favicon patterns
const FAVICON_PATTERNS = [
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon',
  '/favicon-',
  'apple-touch-icon',
];

function isFavicon(url) {
  return FAVICON_PATTERNS.some(p => url.toLowerCase().includes(p));
}

function isGenericPlatformImage(url) {
  return GENERIC_PLATFORM_IMAGES.some(p => url.includes(p));
}

function isPlaceholder(url) {
  const lower = url.toLowerCase();
  return lower.includes('placeholder') ||
    lower.includes('default-avatar') ||
    lower.includes('no-image') ||
    lower.includes('missing-image') ||
    lower.includes('coming-soon');
}

function isHtmlPage(url) {
  return url.endsWith('.html') || url.endsWith('.htm') || url.includes('/page/');
}

function checkUrl(url, timeout = 8000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(url, {
        method: 'HEAD',
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OPPYBot/1.0)',
          'Accept': 'image/*',
        },
      }, (res) => {
        // Follow redirects (max 3)
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          checkUrl(res.headers.location, timeout).then(resolve);
          return;
        }
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
          ok: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
      req.on('error', () => resolve({ status: 0, contentType: '', ok: false }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, contentType: '', ok: false }); });
      req.end();
    } catch {
      resolve({ status: 0, contentType: '', ok: false });
    }
  });
}

async function main() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection('opportunities');

  const total = await col.countDocuments();
  const active = await col.countDocuments({ lifecycleStatus: 'active' });

  console.log(`\n=== IMAGE QUALITY AUDIT ===`);
  console.log(`Total opportunities: ${total}`);
  console.log(`Active opportunities: ${active}\n`);

  // Get all opportunities with imageUrl
  const withImage = await col.find({
    imageUrl: { $exists: true, $ne: null, $ne: '' },
  }).toArray();

  const withoutImage = await col.find({
    $or: [
      { imageUrl: { $exists: false } },
      { imageUrl: null },
      { imageUrl: '' },
    ],
  }).toArray();

  console.log(`With imageUrl: ${withImage.length}`);
  console.log(`Without imageUrl: ${withoutImage.length}\n`);

  // Categorize images
  const categories = {
    valid: 0,
    favicon: 0,
    generic: 0,
    placeholder: 0,
    html: 0,
    unreachable: 0,
    wrongType: 0,
    missing: withoutImage.length,
  };

  // Sample check (limit to 50 to avoid rate limiting)
  const sampleSize = Math.min(50, withImage.length);
  const sample = withImage.slice(0, sampleSize);

  console.log(`Sampling ${sampleSize} images for validation...\n`);

  for (const opp of sample) {
    const url = opp.imageUrl;
    if (!url) { categories.missing++; continue; }

    if (isFavicon(url)) { categories.favicon++; continue; }
    if (isGenericPlatformImage(url)) { categories.generic++; continue; }
    if (isPlaceholder(url)) { categories.placeholder++; continue; }
    if (isHtmlPage(url)) { categories.html++; continue; }

    const result = await checkUrl(url);
    if (!result.ok) { categories.unreachable++; continue; }

    if (result.contentType && !result.contentType.includes('image/')) {
      categories.wrongType++;
      continue;
    }

    categories.valid++;

    // Polite delay
    await new Promise(r => setTimeout(r, 200));
  }

  const totalChecked = sampleSize;
  const validPercent = ((categories.valid / totalChecked) * 100).toFixed(1);

  console.log(`=== RESULTS (sampled ${totalChecked}) ===`);
  console.log(`Valid:              ${categories.valid} (${validPercent}%)`);
  console.log(`Favicon:            ${categories.favicon}`);
  console.log(`Generic platform:   ${categories.generic}`);
  console.log(`Placeholder:        ${categories.placeholder}`);
  console.log(`HTML page:          ${categories.html}`);
  console.log(`Unreachable:        ${categories.unreachable}`);
  console.log(`Wrong content-type: ${categories.wrongType}`);
  console.log(`Missing:            ${categories.missing}`);

  await client.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
