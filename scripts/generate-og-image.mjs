/**
 * Generate the OPPY homepage OG image as a 1200x630 PNG.
 *
 * Uses sharp (bundled with Next.js) to render a high-quality SVG → PNG.
 * Run: node scripts/generate-og-image.mjs
 */

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const WIDTH = 1200;
const HEIGHT = 630;

// Build an SVG string with OPPY branding
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAF8F5"/>
      <stop offset="100%" stop-color="#F3EFE9"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B7DC7"/>
      <stop offset="100%" stop-color="#6B5BA7"/>
    </linearGradient>
    <linearGradient id="oppGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B7DC7"/>
      <stop offset="50%" stop-color="#7B6DB7"/>
      <stop offset="100%" stop-color="#6B5BA7"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Subtle decorative elements -->
  <circle cx="1060" cy="110" r="200" fill="#8B7DC7" opacity="0.06"/>
  <circle cx="140" cy="530" r="140" fill="#8B7DC7" opacity="0.04"/>
  <circle cx="900" cy="500" r="80" fill="#8B7DC7" opacity="0.03"/>

  <!-- Left accent bar -->
  <rect x="80" y="80" width="60" height="4" rx="2" fill="url(#accent)"/>

  <!-- Headline -->
  <text font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="700" fill="#211D2E" letter-spacing="-0.5">
    <tspan x="80" y="175" font-size="50">You shouldn't need 17 tabs</tspan>
    <tspan x="80" y="240" font-size="50">to find one good</tspan>
    <tspan x="80" y="305" font-size="50"><tspan fill="url(#oppGradient)">OPPY</tspan><tspan fill="#211D2E">ortunity.</tspan></tspan>
  </text>

  <!-- Subtitle / category pills -->
  <text x="80" y="380" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="18" fill="#6B6580" letter-spacing="0.3">
    Internships · Jobs · Hackathons · Fellowships · Scholarships · and more
  </text>

  <!-- OPPY brand pill -->
  <rect x="80" y="430" width="130" height="48" rx="14" fill="#211D2E"/>
  <text x="145" y="462" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="24" font-weight="700" fill="#FAF8F5" text-anchor="middle" letter-spacing="3">OPPY</text>

  <!-- Tagline next to pill -->
  <text x="230" y="462" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="19" fill="#6B6580" letter-spacing="0.3">
    Find opportunities that fit you
  </text>

  <!-- Bottom URL -->
  <text x="80" y="595" font-family="monospace" font-size="13" fill="#9B95A8" letter-spacing="0.5">
    main.d9g1xqqpa3n4h.amplifyapp.com
  </text>
</svg>
`;

async function main() {
  const outputPath = join(process.cwd(), "public", "og-homepage.png");

  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(WIDTH, HEIGHT)
    .png({ quality: 95, compressionLevel: 6 })
    .toBuffer();

  writeFileSync(outputPath, pngBuffer);

  const metadata = await sharp(pngBuffer).metadata();
  console.log(`Generated: ${outputPath}`);
  console.log(`Dimensions: ${metadata.width}x${metadata.height}`);
  console.log(`Format: ${metadata.format}`);
  console.log(`Size: ${(pngBuffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error("Failed to generate OG image:", err);
  process.exit(1);
});
