import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Nav from "@/components/Nav";
import { OppyMark } from "@/components/OppyLogo";

export const metadata: Metadata = {
  title: "OPPY — Find opportunities before everyone else",
  description:
    "Discover internships, hackathons, fellowships, scholarships, and events before deadlines pass. Real opportunities from traceable sources.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "OPPY — Find opportunities before everyone else",
    description: "Real opportunity discovery. Internships, hackathons, fellowships, scholarships, events.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ background: "var(--paper)", color: "var(--ink)" }}>
        <AuthProvider>
        {/* Subtle grain texture */}
        <div aria-hidden="true" className="grain" />

        {/* ── Header ──────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-40"
          style={{
            background: "rgba(250,246,239,0.88)",
            backdropFilter: "blur(10px) saturate(140%)",
            borderBottom: "1px solid var(--line)",
            boxShadow: "0 1px 0 rgba(33,29,46,0.02)",
          }}
        >
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-6">
            {/* Wordmark */}
            <a
              href="/"
              className="flex items-center gap-1.5"
              style={{ color: "var(--ink)" }}
            >
              <OppyMark size={28} />
              <span className="font-display text-xl font-semibold tracking-tight">
                PPY
              </span>
            </a>

            <Nav />
          </div>
        </header>

        {/* ── Main ────────────────────────────────────────────────── */}
        <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 relative z-10">
          {children}
        </main>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer
          className="mt-20 border-t py-10"
          style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
        >
          <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-display font-semibold flex items-center gap-1" style={{ color: "var(--ink)" }}>
                <OppyMark size={20} />
                <span>PPY</span>
              </p>
              <p className="eyebrow mt-1">Find opportunities before everyone else</p>
            </div>
            <div className="flex items-center gap-4 text-sm" style={{ color: "var(--ink-soft)" }}>
              <a href="/" className="underline-hover">Browse</a>
              <a href="/saved" className="underline-hover">Saved</a>
            </div>
          </div>
        </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
