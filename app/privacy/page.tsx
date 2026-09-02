import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — OPPY",
  description: "OPPY privacy policy.",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 0" }}>
      <p className="eyebrow mb-4" style={{ textAlign: "center" }}>Privacy</p>
      <h1 className="font-display font-semibold mb-6" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)", textAlign: "center" }}>
        Privacy Policy
      </h1>
      <div style={{ lineHeight: 1.8, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
        <p className="mb-4"><em>Last updated: September 2026</em></p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>What we collect</h2>
        <p className="mb-4">
          OPPY collects information you provide directly: your name, email address, skills, interests, experience level, location preferences, and avatar selection. We also collect usage data such as pages viewed, opportunities saved, and application tracking status.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>How we use it</h2>
        <p className="mb-4">
          We use your information to personalize your opportunity feed, improve recommendations, and provide core product functionality. We do not sell your personal data to third parties.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Opportunity data</h2>
        <p className="mb-4">
          OPPY collects publicly available opportunity information from various sources. This data belongs to the original publishers. We display it with attribution and link back to original sources.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Authentication</h2>
        <p className="mb-4">
          OPPY supports email/password and Google sign-in. When you sign in with Google, we receive your name and email address from Google. We do not store Google access or refresh tokens. Session data is stored securely in MongoDB using httpOnly cookies.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Data storage</h2>
        <p className="mb-4">
          Your data is stored securely in MongoDB. We use industry-standard security practices. We do not store third-party authentication tokens beyond what is necessary for session management.
        </p>

        <h2 className="font-display font-semibold mt-8 mb-3" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>Contact</h2>
        <p className="mb-4">
          For privacy-related inquiries, contact us at{" "}
          <a href="mailto:hello.oppy.in@gmail.com" style={{ color: "var(--accent-deep)", textDecoration: "underline" }}>
            hello.oppy.in@gmail.com
          </a>.
        </p>
      </div>
    </div>
  );
}
