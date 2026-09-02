import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — OPPY",
  description: "OPPY terms of service.",
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 0" }}>
      <p className="eyebrow mb-4" style={{ textAlign: "center" }}>Terms</p>
      <h1 className="font-display font-semibold mb-6" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)", textAlign: "center" }}>
        Terms of Service
      </h1>
      <div style={{ lineHeight: 1.8, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
        <p className="mb-4"><em>Last updated: September 2026</em></p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Using OPPY</h2>
        <p className="mb-4">
          OPPY is an opportunity discovery platform. By using OPPY, you agree to these terms. OPPY is provided as-is. We work to keep opportunity information accurate, but we cannot guarantee the completeness or accuracy of third-party listings.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Your account</h2>
        <p className="mb-4">
          You are responsible for maintaining the security of your account. Do not share your credentials. You may delete your account at any time by contacting us.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Opportunity listings</h2>
        <p className="mb-4">
          OPPY aggregates publicly available opportunity information. OPPY is not affiliated with the organizations listed unless explicitly stated. Always verify details on the original source before applying.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Intellectual property</h2>
        <p className="mb-4">
          OPPY&apos;s design, branding, code, and original content are owned by OPPY. Opportunity listings belong to their respective publishers.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Contact</h2>
        <p className="mb-4">
          Questions about these terms? Email us at{" "}
          <a href="mailto:hello.oppy.in@gmail.com" style={{ color: "var(--accent-deep)", textDecoration: "underline" }}>
            hello.oppy.in@gmail.com
          </a>.
        </p>
      </div>
    </div>
  );
}
