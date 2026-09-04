import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import AccentProvider from "@/components/AccentProvider";
import Nav from "@/components/Nav";

import Footer from "@/components/Footer";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://main.d9g1xqqpa3n4h.amplifyapp.com";
const OG_IMAGE = "/og-homepage.png";

export const metadata: Metadata = {
  title: "OPPY — Find opportunities that fit you",
  description:
    "Find internships, jobs, hackathons, fellowships, scholarships and more — all in one place.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "OPPY — Find opportunities that fit you",
    description: "Find internships, jobs, hackathons, fellowships, scholarships and more — all in one place.",
    url: SITE_URL,
    siteName: "OPPY",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "OPPY — Find opportunities that fit you",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OPPY — Find opportunities that fit you",
    description: "Find internships, jobs, hackathons, fellowships, scholarships and more — all in one place.",
    images: [OG_IMAGE],
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
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>
                OPPY
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
