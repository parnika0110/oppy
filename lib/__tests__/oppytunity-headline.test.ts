import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const landingCode = readFileSync("components/LandingPage.tsx", "utf8");
const headlineCode = readFileSync("components/AnimatedHeadline.tsx", "utf8");
const cssCode = readFileSync("app/globals.css", "utf8");

// ── 1. Headline text content ──────────────────────────────────────────────

describe("OPPYortunity headline — text content", () => {
  it("uses AnimatedHeadline component instead of static h2", () => {
    expect(landingCode).toContain("<AnimatedHeadline />");
    expect(landingCode).toContain('import AnimatedHeadline');
  });

  it("AnimatedHeadline contains the OPPYortunity text", () => {
    expect(headlineCode).toContain("ortunity.");
  });

  it("OPPY is a separate span for styling", () => {
    expect(headlineCode).toContain("oppytunity-oppy");
    expect(headlineCode).toContain(">OPPY<");
  });

  it("contains the 'good' prefix before OPPYortunity", () => {
    expect(headlineCode).toContain('good{" "}');
  });

  it("contains the full original headline text", () => {
    expect(headlineCode).toContain("shouldn&apos;t need");
    expect(headlineCode).toContain("17 tabs to find one");
  });
});

// ── 2. OPPY visual treatment ─────────────────────────────────────────────

describe("OPPYortunity — visual treatment", () => {
  it("oppytunity-oppy has gradient text", () => {
    expect(cssCode).toContain(".oppytunity-oppy");
    expect(cssCode).toContain("background: linear-gradient");
    expect(cssCode).toContain("background-clip: text");
  });

  it("oppytunity-oppy uses accent colors", () => {
    expect(cssCode).toContain("var(--lavender-deep)");
    expect(cssCode).toContain("var(--accent-deep)");
  });

  it("lp-headline-accent wraps the accent line", () => {
    expect(headlineCode).toContain("lp-headline-accent");
    expect(cssCode).toContain(".lp-headline-accent");
  });
});

// ── 3. Entrance animation ─────────────────────────────────────────────────

describe("OPPYortunity — entrance animation", () => {
  it("uses IntersectionObserver for scroll-triggered animation", () => {
    expect(headlineCode).toContain("IntersectionObserver");
  });

  it("has visible state", () => {
    expect(headlineCode).toContain("visible");
    expect(headlineCode).toContain("oppytunity--visible");
  });

  it("animation triggers once (observer disconnects)", () => {
    expect(headlineCode).toContain("observer.disconnect()");
  });

  it("oppytunity starts invisible", () => {
    expect(cssCode).toContain(".oppytunity {");
    expect(cssCode).toContain("opacity: 0");
  });

  it("oppytunity becomes visible with transition", () => {
    expect(cssCode).toContain(".oppytunity--visible {");
    expect(cssCode).toContain("opacity: 1");
    expect(cssCode).toContain("transform: translateY(0)");
  });

  it("has smooth transition properties", () => {
    expect(cssCode).toContain("transition: opacity 0.5s ease, transform 0.5s ease");
  });

  it("OPPY gets a brightness sweep animation", () => {
    expect(cssCode).toContain("oppy-sweep");
    expect(cssCode).toContain("@keyframes oppy-sweep");
  });
});

// ── 4. Reduced motion ────────────────────────────────────────────────────

describe("OPPYortunity — accessibility", () => {
  it("respects prefers-reduced-motion", () => {
    expect(headlineCode).toContain("prefers-reduced-motion: reduce");
  });

  it("reduced-motion CSS disables transition and animation", () => {
    expect(cssCode).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssCode).toContain(".oppytunity {");
  });
});

// ── 5. Layout balance ─────────────────────────────────────────────────────

describe("Problem section — layout balance", () => {
  it("uses two-column grid with reduced gap", () => {
    expect(cssCode).toContain("grid-template-columns: 1fr 1fr");
    expect(cssCode).toContain("gap: 3rem");
  });

  it("left column has max-width constraint", () => {
    expect(cssCode).toContain(".lp-problem-left");
    expect(cssCode).toContain("max-width: 32rem");
  });

  it("right column is flex-centered", () => {
    expect(cssCode).toContain(".lp-problem-right");
    expect(cssCode).toContain("align-items: center");
  });

  it("copy text is center-aligned", () => {
    expect(cssCode).toContain(".lp-problem-copy");
    expect(cssCode).toContain("text-align: center");
  });
});

// ── 6. Landing page preserved structure ───────────────────────────────────

describe("Landing page — preserved structure", () => {
  it("problem section still uses lp-problem grid", () => {
    expect(landingCode).toContain("lp-problem");
  });

  it("problem section still has eyebrow label", () => {
    expect(landingCode).toContain("The problem");
  });

  it("problem section still has right-side tabs visual", () => {
    expect(landingCode).toContain("lp-tabs-visual");
    expect(landingCode).toContain("lp-tab-merge");
  });

  it("problem section still has supporting copy", () => {
    expect(landingCode).toContain("lp-problem-copy");
  });

  it("no static h2 with 'good opportunity' remains", () => {
    expect(landingCode).not.toMatch(/good.*opportunity\./i);
  });
});
