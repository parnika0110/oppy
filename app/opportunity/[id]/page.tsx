import { notFound } from "next/navigation";
import { Suspense } from "react";
import SaveButton from "@/components/SaveButton";
import ViewTracker from "@/components/ViewTracker";
import SimilarOpportunities from "@/components/SimilarOpportunities";
import { DetailImage } from "@/components/DetailImage";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import ShareButton from "@/components/ShareButton";
import { OpportunityDocument } from "@/types/opportunity";
import { getBestCtaUrl, getCtaLabel } from "@/lib/url-utils";

// ── Design token helpers ──────────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  Hackathon:   { bg: "#D2C9EE", color: "#4A3F8A" },
  Internship:  { bg: "#F0C6A0", color: "#7A4A1A" },
  Fellowship:  { bg: "#B3CDA8", color: "#2E5A28" },
  Scholarship: { bg: "#ACCEDF", color: "#1F4A62" },
  Grant:       { bg: "#E8D5C4", color: "#6B3F1F" },
  Event:       { bg: "#F0E8FF", color: "#5B3D8A" },
};

const AVATAR_GRADIENTS: Record<string, string> = {
  Hackathon:   "linear-gradient(135deg, #D2C9EE 0%, #8B7DC7 100%)",
  Internship:  "linear-gradient(135deg, #F0C6A0 0%, #C98A4B 100%)",
  Fellowship:  "linear-gradient(135deg, #B3CDA8 0%, #6E9463 100%)",
  Scholarship: "linear-gradient(135deg, #ACCEDF 0%, #5D8BA3 100%)",
  Grant:       "linear-gradient(135deg, #E8D5C4 0%, #B8946C 100%)",
  Event:       "linear-gradient(135deg, #E8D0FF 0%, #9B6CC7 100%)",
};

function fmtDate(iso: string | Date | null | undefined) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(
      new Date(iso as string)
    );
  } catch { return null; }
}

function getUrgency(deadline: string | null, deadlineKind: string | null) {
  if (!deadline || !["verified", "source_provided"].includes(deadlineKind ?? "")) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return { label: "This opportunity has expired", bg: "#F1F5F9", color: "#64748B" };
  if (days <= 3)  return { label: `⚡ ${days} day${days !== 1 ? "s" : ""} left to apply`, bg: "#FEE2E2", color: "#991B1B" };
  if (days <= 14) return { label: `⏰ ${days} days left`, bg: "#FEF3C7", color: "#92400E" };
  return null;
}

function timeAgo(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso as string).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

async function getOpportunity(id: string): Promise<OpportunityDocument | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/opportunities/${id}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load opportunity");
  const data = await res.json();
  return data.item;
}

export default async function OpportunityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opp = await getOpportunity(id);
  if (!opp) notFound();

  const cat = CATEGORY_STYLES[opp.category] ?? CATEGORY_STYLES.Event;
  const gradient = AVATAR_GRADIENTS[opp.category] ?? AVATAR_GRADIENTS.Event;
  const urgency = getUrgency(opp.deadline, opp.deadlineKind);
  const isClosed = opp.lifecycleStatus === "closed" || opp.lifecycleStatus === "archived";
  const ctaUrl = getBestCtaUrl(opp);
  
  const rawPlatform = opp.sourcePlatform || (opp as any).source || null;
  const sourcePlatform = rawPlatform === "Other" ? ((opp as any).source || opp.organization || null) : rawPlatform;
  
  const isRolling = opp.deadlineKind === "rolling";

  // Category-aware CTA label
  const ctaLabel = (() => {
    const cat = opp.category;
    if (cat === "Event" || cat === "Hackathon") return "Register →";
    if (cat === "Job" || cat === "Internship") return "Apply →";
    if (cat === "Fellowship" || cat === "Scholarship" || cat === "Grant") return "Learn more →";
    return "Visit source →";
  })();

  const appDeadline = fmtDate((opp as any).applicationDeadline || opp.deadline);
  const regDeadline = fmtDate((opp as any).registrationDeadline);
  const eventDate = fmtDate((opp as any).eventDate);
  const isVerifiedDeadline = ["verified", "source_provided"].includes(opp.deadlineKind ?? "");

  // Freshness metadata
  const verifiedAgo = timeAgo(opp.lastVerifiedAt);
  const discoveredAgo = timeAgo((opp as any).discoveredAt || opp.createdAt);
  const isNew = (() => {
    const da = (opp as any).discoveredAt || opp.createdAt;
    if (!da) return false;
    return Date.now() - new Date(da).getTime() < 48 * 3600 * 1000;
  })();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Track this view for "Recently Viewed" on the dashboard */}
      <ViewTracker opportunityId={opp._id} />

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <a
        href="/"
        className="eyebrow mb-6 inline-flex items-center gap-1.5 transition-colors"
        style={{ color: "var(--ink-soft)" }}
      >
        ← Browse
      </a>

      {/* ── Hero card ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden mt-4"
        style={{ border: "1px solid var(--line)", background: "var(--card)" }}
      >
        {/* Hero image — client component to allow onError */}
        <div className="relative">
          {isClosed && (
            <div className="absolute top-4 left-4 z-10">
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(255,255,255,0.7)", color: "#64748B" }}
              >
                Closed
              </span>
            </div>
          )}
          {isNew && (
            <div className="absolute top-4 left-4 z-10" style={{ left: isClosed ? "auto" : "1rem", right: isClosed ? "1rem" : "auto" }}>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: "var(--lavender-deep)", color: "white" }}
              >
                NEW
              </span>
            </div>
          )}
          <div className="absolute top-4 right-4 z-10">
            <SaveButton id={opp._id} />
          </div>
          <DetailImage opp={opp} />
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: cat.bg, color: cat.color, letterSpacing: "0.02em" }}
              >
                {opp.category}
              </span>
              {sourcePlatform && (
                <span className="eyebrow" style={{ fontSize: "0.65rem" }}>via {sourcePlatform}</span>
              )}
            </div>
            <p className="eyebrow" style={{ fontSize: "0.7rem" }}>{opp.organization}</p>
            <h1
              className="mt-1 font-display font-semibold leading-tight"
              style={{ fontSize: "clamp(1.35rem, 3vw, 1.75rem)", color: "var(--ink)" }}
            >
              {opp.title}
            </h1>
          </div>

          {(opp.location || (opp as any).isRemote) && (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              {(opp as any).isRemote ? "🌐 Remote / Online" : `📍 ${opp.location}`}
            </p>
          )}

          {urgency && (
            <div
              className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", background: urgency.bg, color: urgency.color }}
            >
              {urgency.label}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
              {eventDate && (
                <div className="surface-flat p-4">
                  <p className="eyebrow mb-1">Event date</p>
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{eventDate}</p>
                </div>
              )}
              {appDeadline && isVerifiedDeadline ? (
                <div className="surface-flat p-4">
                  <p className="eyebrow mb-1">Application deadline</p>
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{appDeadline}</p>
                </div>
              ) : isRolling ? (
                <div className="surface-flat p-4">
                  <p className="eyebrow mb-1">Application deadline</p>
                  <p className="text-sm font-medium" style={{ color: "var(--sage-deep)" }}>Rolling / Open</p>
                </div>
              ) : (
                <div className="surface-flat p-4">
                  <p className="eyebrow mb-1">Application deadline</p>
                  <p className="text-sm" style={{ color: "var(--ink-soft)", opacity: 0.7 }}>Unavailable</p>
                </div>
              )}
              {regDeadline && (
                <div className="surface-flat p-4">
                  <p className="eyebrow mb-1">Registration deadline</p>
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{regDeadline}</p>
                </div>
              )}
            </div>

          {opp.tags && opp.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {opp.tags.map((tag) => (
                <span key={tag} className="chip">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Summary ──────────────────────────────────────────── */}
      {opp.aiSummary && (
        <div
          className="mt-5 rounded-2xl p-6 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--lavender)" }}
        >
          <p className="eyebrow" style={{ color: "#8B7DC7" }}>✦ AI Summary</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            {opp.aiSummary.summary}
          </p>
          {(opp.aiSummary.eligibility?.length ?? 0) > 0 && (
            <div>
              <p className="eyebrow mb-2">Eligibility</p>
              <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: "var(--ink-soft)" }}>
                {opp.aiSummary.eligibility.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {(opp.aiSummary.keyDates?.length ?? 0) > 0 && (
            <div>
              <p className="eyebrow mb-2">Key Dates</p>
              <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: "var(--ink-soft)" }}>
                {opp.aiSummary.keyDates.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
          {(opp.aiSummary.takeaways?.length ?? 0) > 0 && (
            <div>
              <p className="eyebrow mb-2">Key Takeaways</p>
              <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: "var(--ink-soft)" }}>
                {opp.aiSummary.takeaways.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Description ─────────────────────────────────────────── */}
      {opp.description && (
        <div
          className="mt-5 rounded-2xl p-6"
          style={{ background: "var(--card)", border: "1px solid var(--line)" }}
        >
          <p className="eyebrow mb-3">About this opportunity</p>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--ink-soft)" }}>
            {opp.description}
          </p>
        </div>
      )}

      {/* ── Source provenance ────────────────────────────────────── */}
      <div
        className="mt-5 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
      >
        <div className="flex-1">
          <p className="eyebrow mb-0.5">Official source</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
            Always verify dates and requirements at the official source.
          </p>
          {verifiedAgo && (
            <p className="eyebrow mt-1" style={{ fontSize: "0.6rem" }}>
              Verified {verifiedAgo}
            </p>
          )}
          {discoveredAgo && (
            <p className="eyebrow mt-0.5" style={{ fontSize: "0.6rem" }}>
              Discovered {discoveredAgo}
            </p>
          )}
        </div>
        <a
          href={opp.officialSourceUrl || opp.sourceUrl || opp.applicationLink || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium underline-hover shrink-0"
          style={{ color: "#8B7DC7", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Open source ↗
        </a>
      </div>

      {/* ── CTA Button ──────────────────────────────────────────── */}
      {ctaUrl && (
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 block w-full text-center font-semibold py-3.5 rounded-2xl transition-opacity hover:opacity-90"
          style={{
            background: isClosed ? "var(--ink-soft)" : "var(--ink)",
            color: "var(--paper)",
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "0.95rem",
            letterSpacing: "0.01em",
          }}
        >
          {isClosed ? "Visit official source →" : ctaLabel}
        </a>
      )}

      {/* ── Similar Opportunities ──────────────────────────────── */}
      <SimilarOpportunities opportunityId={opp._id} />
    </div>
  );
}
