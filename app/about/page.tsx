import type { Metadata } from "next";
import ThemedOppyOrb from "@/components/ThemedOppyOrb";

export const metadata: Metadata = {
  title: "About — OPPY",
  description: "OPPY discovers and surfaces opportunities from across the web so you spend less time searching and more time doing.",
};

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 0" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
        <ThemedOppyOrb mood="welcoming" size={56} />
      </div>
      <p className="eyebrow mb-4" style={{ textAlign: "center" }}>About OPPY</p>
      <h1 className="font-display font-semibold mb-6" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)", textAlign: "center" }}>
        Good opportunities shouldn&apos;t be this hard to find.
      </h1>
      <div style={{ lineHeight: 1.8, color: "var(--ink-soft)", fontSize: "0.95rem" }}>
        <p className="mb-4">
          OPPY is an opportunity discovery platform built for students and early-career professionals. We collect internships, hackathons, fellowships, scholarships, grants, and events from across the web — then surface the ones that actually matter to you.
        </p>
        <p className="mb-4">
          The opportunity landscape is fragmented. Deadlines pass quietly. Relevant programs hide behind irrelevant ones. OPPY exists to fix that.
        </p>
        <p className="mb-4">
          We continuously collect opportunities from multiple sources, normalize them, verify dates, score relevance, and deliver a personalized feed. Less time searching. More time doing.
        </p>
        <p>
          OPPY is built with care and transparency. Every opportunity in our feed comes from a traceable source with verified metadata.
        </p>
      </div>
    </div>
  );
}
