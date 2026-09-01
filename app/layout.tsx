import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import AccentProvider from "@/components/AccentProvider";
import Nav from "@/components/Nav";
import { OppyMark } from "@/components/OppyLogo";
import Footer from "@/components/Footer";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/oppy-favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ background: "var(--paper)", color: "var(--ink)" }}>
        <AuthProvider>
        <AccentProvider>
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
        <Footer />
        </AccentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
