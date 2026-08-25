import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OPPY — Never miss an opportunity",
  description:
    "Discover internships, hackathons, fellowships, scholarships, and events before deadlines pass.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-gray-900">
              OPPY
            </a>
            <nav className="flex gap-6 text-sm font-medium text-gray-600">
              <a href="/" className="hover:text-gray-900">Browse</a>
              <a href="/saved" className="hover:text-gray-900">Saved</a>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
