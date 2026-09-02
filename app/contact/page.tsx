import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — OPPY",
  description: "Get in touch with the OPPY team.",
};

export default function ContactPage() {
  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "2rem 0" }}>
      <p className="eyebrow mb-4" style={{ textAlign: "center" }}>Contact</p>
      <h1 className="font-display font-semibold mb-6" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)", textAlign: "center" }}>
        Get in touch
      </h1>
      <div style={{ lineHeight: 1.8, color: "var(--ink-soft)", fontSize: "0.95rem", textAlign: "center" }}>
        <p className="mb-4">
          Have a question, suggestion, or want to report an issue with an opportunity?
        </p>
        <p className="mb-6">
          Reach us at{" "}
          <a
            href="mailto:hello.oppy.in@gmail.com"
            style={{ color: "var(--accent-deep)", textDecoration: "underline" }}
          >
            hello.oppy.in@gmail.com
          </a>
        </p>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--card)",
          }}
        >
          <p className="eyebrow mb-2">Report an opportunity</p>
          <p style={{ fontSize: "0.85rem" }}>
            Found a broken link, expired listing, or incorrect information? Email us with the opportunity title and URL, and we&apos;ll investigate.
          </p>
        </div>
      </div>
    </div>
  );
}
