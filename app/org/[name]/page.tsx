import { notFound } from "next/navigation";
import OpportunityCard from "@/components/OpportunityCard";
import { OpportunityDocument } from "@/types/opportunity";

async function getOrgData(name: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/organizations?name=${encodeURIComponent(name)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return {
    title: `${decoded} — OPPY`,
    description: `Browse ${decoded} opportunities on OPPY — internships, jobs, hackathons, fellowships, and more.`,
  };
}

export default async function OrgProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const data = await getOrgData(decoded);

  if (!data || !data.items || data.items.length === 0) {
    notFound();
  }

  const items = data.items as OpportunityDocument[];

  return (
    <div>
      {/* Org Header */}
      <div className="mb-8">
        <p className="eyebrow mb-2">Organization</p>
        <h1
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)" }}
        >
          {decoded}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: "var(--lavender)",
              color: "#4A3F8A",
            }}
          >
            {data.total} active {data.total === 1 ? "opportunity" : "opportunities"}
          </span>
          {data.categories?.map((cat: string) => (
            <span
              key={cat}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: "var(--card)",
                color: "var(--ink-soft)",
                border: "1px solid var(--line)",
              }}
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((opp) => (
          <OpportunityCard key={opp._id} opportunity={opp} />
        ))}
      </div>

      {/* Back link */}
      <div className="mt-10">
        <a
          href="/"
          className="text-sm font-medium underline-hover"
          style={{ color: "var(--lavender-deep)", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          ← Browse all opportunities
        </a>
      </div>
    </div>
  );
}
