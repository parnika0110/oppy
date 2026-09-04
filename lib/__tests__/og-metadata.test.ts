import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const layoutCode = readFileSync("app/layout.tsx", "utf8");
const detailCode = readFileSync("app/opportunity/[id]/page.tsx", "utf8");
const ogPngPath = join(process.cwd(), "public", "og-homepage.png");
const ogPngExists = existsSync(ogPngPath);

// ── 1. Homepage OG metadata ─────────────────────────────────────────────

describe("Homepage — OG metadata", () => {
  it("has og:title with expected copy", () => {
    expect(layoutCode).toContain('"OPPY — Find opportunities that fit you"');
  });

  it("has og:description with expected copy", () => {
    expect(layoutCode).toContain('"Find internships, jobs, hackathons, fellowships, scholarships and more — all in one place."');
  });

  it("has og:type website", () => {
    expect(layoutCode).toContain('type: "website"');
  });

  it("has og:image pointing to /og-homepage.png", () => {
    expect(layoutCode).toContain("/og-homepage.png");
    expect(layoutCode).not.toContain("/og-homepage.svg");
  });

  it("has og:image dimensions 1200x630", () => {
    expect(layoutCode).toContain("width: 1200");
    expect(layoutCode).toContain("height: 630");
  });

  it("has og:url using SITE_URL", () => {
    expect(layoutCode).toContain("url: SITE_URL");
  });

  it("has og:siteName OPPY", () => {
    expect(layoutCode).toContain('siteName: "OPPY"');
  });
});

// ── 2. Twitter metadata ─────────────────────────────────────────────────

describe("Homepage — Twitter metadata", () => {
  it("has twitter:card summary_large_image", () => {
    expect(layoutCode).toContain('card: "summary_large_image"');
  });

  it("has twitter:title", () => {
    expect(layoutCode).toContain("twitter:");
    expect(layoutCode).toContain('"OPPY — Find opportunities that fit you"');
  });

  it("has twitter:description", () => {
    expect(layoutCode).toContain("twitter:");
  });

  it("has twitter:images using OG_IMAGE (PNG)", () => {
    expect(layoutCode).toContain("images: [OG_IMAGE]");
  });
});

// ── 3. Production URL safety ────────────────────────────────────────────

describe("Homepage — production URL safety", () => {
  it("SITE_URL defaults to production URL, not localhost", () => {
    expect(layoutCode).toContain("https://main.d9g1xqqpa3n4h.amplifyapp.com");
  });

  it("SITE_URL uses NEXT_PUBLIC_APP_URL env var when available", () => {
    expect(layoutCode).toContain("process.env.NEXT_PUBLIC_APP_URL");
  });

  it("metadataBase uses SITE_URL", () => {
    expect(layoutCode).toContain("metadataBase: new URL(SITE_URL)");
  });

  it("OG image URL does not contain localhost", () => {
    expect(layoutCode).toContain('"/og-homepage.png"');
    expect(layoutCode).not.toContain("localhost");
  });
});

// ── 4. OG image exists and is PNG ───────────────────────────────────────

describe("OG image — static PNG asset", () => {
  it("og-homepage.png exists in public/", () => {
    expect(ogPngExists).toBe(true);
  });

  it("PNG file is a valid PNG (magic bytes)", () => {
    if (!ogPngExists) return;
    const buf = readFileSync(ogPngPath);
    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // P
    expect(buf[2]).toBe(0x4e); // N
    expect(buf[3]).toBe(0x47); // G
  });

  it("PNG dimensions are 1200x630", () => {
    if (!ogPngExists) return;
    const buf = readFileSync(ogPngPath);
    // PNG IHDR chunk: width at offset 16, height at offset 20 (big-endian uint32)
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  it("PNG file size is reasonable (> 1KB, < 500KB)", () => {
    if (!ogPngExists) return;
    const buf = readFileSync(ogPngPath);
    expect(buf.length).toBeGreaterThan(1024);
    expect(buf.length).toBeLessThan(500 * 1024);
  });
});

// ── 5. Opportunity detail OG unchanged ──────────────────────────────────

describe("Opportunity detail — OG metadata preserved", () => {
  it("detail page has generateMetadata", () => {
    expect(detailCode).toContain("export async function generateMetadata");
  });

  it("detail page uses opportunity-specific title", () => {
    expect(detailCode).toContain("opp.title");
  });

  it("detail page uses opportunity-specific OG image", () => {
    expect(detailCode).toContain("opp.imageUrl");
  });

  it("detail page has twitter card summary_large_image", () => {
    expect(detailCode).toContain('card: "summary_large_image"');
  });

  it("detail page has canonical URL", () => {
    expect(detailCode).toContain("canonical: oppUrl");
  });

  it("detail page OG does not use the homepage OG image", () => {
    expect(detailCode).not.toContain("og-homepage.svg");
    expect(detailCode).not.toContain("og-homepage.png");
  });
});

// ── 6. No localhost in production metadata ──────────────────────────────

describe("No localhost in metadata", () => {
  it("layout metadata does not use localhost as metadataBase", () => {
    expect(layoutCode).not.toContain('"http://localhost:3000"');
  });

  it("SITE_URL fallback is the production domain", () => {
    expect(layoutCode).toContain('"https://main.d9g1xqqpa3n4h.amplifyapp.com"');
  });
});

// ── 7. OG image headline emphasis (OPPY vs ortonity) ─────────────────────

describe("OG image — OPPYortunity headline emphasis", () => {
  const genCode = readFileSync("scripts/generate-og-image.mjs", "utf8");
  const svgCode = readFileSync("public/og-homepage.svg", "utf8");

  it("generator renders OPPY and ortonity as separate runs", () => {
    expect(genCode).toContain(">OPPY</tspan>");
    expect(genCode).toContain(">ortunity.</tspan>");
    expect(genCode).not.toContain(">opportunity.</tspan>");
  });

  it("OPPY uses the brand purple accent, ortonity uses ink", () => {
    expect(genCode).toContain('fill="url(#oppGradient)">OPPY</tspan>');
    expect(genCode).toContain('<tspan fill="#211D2E">ortunity.</tspan>');
  });

  it("static SVG source keeps the same split treatment", () => {
    expect(svgCode).toContain(">OPPY</tspan>");
    expect(svgCode).toContain(">ortunity.</tspan>");
    expect(svgCode).not.toContain(">opportunity.</tspan>");
  });

  it("generated PNG headline shows purple OPPY + ink ortonity", async () => {
    if (!ogPngExists) return;
    const { data, info } = await sharp(ogPngPath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const ch = info.channels;
    let purple = 0;
    let ink = 0;
    // third headline line band (baseline y=305, font-size 50)
    for (let y = 275; y < 345; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * ch;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        // #8B7DC7-ish (blue-dominant purple)
        if (Math.abs(r - 0x8b) < 45 && Math.abs(g - 0x7d) < 45 && Math.abs(b - 0xc7) < 45 && b > r && r > g) purple++;
        // #211D2E-ish ink
        if (Math.abs(r - 0x21) < 30 && Math.abs(g - 0x1d) < 30 && Math.abs(b - 0x2e) < 30) ink++;
      }
    }
    expect(purple).toBeGreaterThan(500);
    expect(ink).toBeGreaterThan(500);
  });
});
