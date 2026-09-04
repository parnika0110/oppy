/**
 * Generate the OPPY email logo as a transparent PNG.
 *
 * Horizontal composition: O mark + "PPY" wordmark
 * 2x resolution for ~200–300px display width
 * Transparent background for email client compatibility
 *
 * Run: node scripts/generate-email-logo.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

// 2x resolution: 600×120 renders at 300×60 or 200×40
const WIDTH = 600;
const HEIGHT = 120;

// OPPY brand colors (from OppyLogo.tsx)
const NAVY = "#211D2E";
const LAVENDER = "#8B7DC7";
const PEACH = "#C98A4B";

// O mark geometry (from OppyLogo.tsx)
const CX = 50, CY = 50;
const OUTER_R = 44, INNER_R = 30;
const GAP_TOP = (-22 * Math.PI) / 180;
const GAP_BOT = (18 * Math.PI) / 180;

function polar(cx, cy, r, a) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const oTop = polar(CX, CY, OUTER_R, GAP_TOP);
const oBot = polar(CX, CY, OUTER_R, GAP_BOT);
const iTop = polar(CX, CY, INNER_R, GAP_TOP);
const iBot = polar(CX, CY, INNER_R, GAP_BOT);

const ringPath = [
  `M ${oTop[0].toFixed(1)} ${oTop[1].toFixed(1)}`,
  `A ${OUTER_R} ${OUTER_R} 0 1 0 ${oBot[0].toFixed(1)} ${oBot[1].toFixed(1)}`,
  `L ${iBot[0].toFixed(1)} ${iBot[1].toFixed(1)}`,
  `A ${INNER_R} ${INNER_R} 0 1 1 ${iTop[0].toFixed(1)} ${iTop[1].toFixed(1)}`,
  "Z",
].join(" ");

const portalPath = [
  `M ${oTop[0].toFixed(1)} ${oTop[1].toFixed(1)}`,
  `L ${iTop[0].toFixed(1)} ${iTop[1].toFixed(1)}`,
  `L ${iBot[0].toFixed(1)} ${iBot[1].toFixed(1)}`,
  `L ${oBot[0].toFixed(1)} ${oBot[1].toFixed(1)}`,
  "Z",
].join(" ");

// Scale the 100×100 O mark to fit in the email logo
// Mark: 80×80 positioned at (30, 20) in the 600×120 canvas
const MARK_X = 30;
const MARK_Y = 10;
const MARK_SIZE = 100;
const MARK_SCALE = 0.8;

// "PPY" text positioned to the right of the mark
const TEXT_X = MARK_X + MARK_SIZE * MARK_SCALE + 12;
const TEXT_Y = 78;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="portal" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PEACH}" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#D2C9EE" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${LAVENDER}" stop-opacity="0.5"/>
    </linearGradient>
  </defs>

  <!-- O Mark -->
  <g transform="translate(${MARK_X}, ${MARK_Y}) scale(${MARK_SCALE})">
    <path d="${ringPath}" fill="${NAVY}"/>
    <path d="${portalPath}" fill="url(#portal)"/>
    <line
      x1="${iBot[0].toFixed(1)}" y1="${iBot[1].toFixed(1)}"
      x2="${oBot[0].toFixed(1)}" y2="${oBot[1].toFixed(1)}"
      stroke="${PEACH}" stroke-width="0.6" opacity="0.3"
    />
  </g>

  <!-- PPY wordmark -->
  <text
    x="${TEXT_X}" y="${TEXT_Y}"
    font-family="'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif"
    font-size="72"
    font-weight="700"
    letter-spacing="-1"
    fill="${NAVY}"
  >PPY</text>
</svg>
`;

async function main() {
  const outputPath = join(process.cwd(), "public", "email-logo.png");

  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(WIDTH, HEIGHT)
    .png({ quality: 95, compressionLevel: 6 })
    .toBuffer();

  writeFileSync(outputPath, pngBuffer);

  const metadata = await sharp(pngBuffer).metadata();
  console.log(`Generated: ${outputPath}`);
  console.log(`Dimensions: ${metadata.width}x${metadata.height}`);
  console.log(`Format: ${metadata.format}`);
  console.log(`Has alpha: ${metadata.hasAlpha}`);
  console.log(`Size: ${(pngBuffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error("Failed to generate email logo:", err);
  process.exit(1);
});
