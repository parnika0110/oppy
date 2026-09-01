"use client";

import ThemedOppyOrb from "@/components/ThemedOppyOrb";

/**
 * OPPY Footer — a distinctive branded closing experience.
 *
 * Structure:
 *   1. Closing section — ThemedOppyOrb mascot + editorial headline + CTA
 *   2. Navigation grid — Discover / Your OPPY / Company
 *   3. Brand signature
 *
 * Uses the existing accent CSS variables (--accent, --accent-deep) so the
 * footer respects the user's avatar theme (rose, sage, etc.).
 */

const NAV_SECTIONS = [
  {
    title: "Discover",
    links: [
      { label: "Browse", href: "/" },
      { label: "Internships", href: "/?category=Internship" },
      { label: "Hackathons", href: "/?category=Hackathon" },
      { label: "Fellowships", href: "/?category=Fellowship" },
      { label: "Grants", href: "/?category=Grant" },
      { label: "Events", href: "/?category=Event" },
    ],
  },
  {
    title: "Your OPPY",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Saved", href: "/saved" },
      { label: "Profile", href: "/profile" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="oppy-footer" role="contentinfo">
      {/* ── Closing Section ──────────────────────────────────── */}
      <div className="oppy-footer-closing">
        <div className="oppy-footer-orb-wrap">
          <div className="oppy-footer-orb-glow" aria-hidden="true" />
          <ThemedOppyOrb mood="excited" size={64} />
        </div>

        <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>
          OPPY
        </p>
        <h2 className="oppy-footer-headline">
          Still looking?
        </h2>
        <p className="oppy-footer-sub">
          OPPY can help you find something worth your time.
        </p>

        <a href="/#discover" className="oppy-footer-cta">
          Find my opportunities →
        </a>
      </div>

      {/* ── Navigation Grid ──────────────────────────────────── */}
      <div className="oppy-footer-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="oppy-footer-nav-col">
            <p className="oppy-footer-nav-title">{section.title}</p>
            <ul className="oppy-footer-nav-list">
              {section.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="oppy-footer-nav-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Brand Signature ──────────────────────────────────── */}
      <div className="oppy-footer-signature">
        <p className="oppy-footer-brand">OPPY — Opportunity Discovery Platform.</p>
        <p className="oppy-footer-tagline">
          Good opportunities shouldn&apos;t be this hard to find.
        </p>
      </div>
    </footer>
  );
}
