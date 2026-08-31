"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { OpportunityDocument } from "@/types/opportunity";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";
import DeadlineCountdown from "./DeadlineCountdown";
import { getBestCtaUrl } from "@/lib/url-utils";
import { decodeHtmlEntities } from "@/lib/html-entities";

// Display-time decoder — ensures existing DB records with encoded entities render cleanly
const d = (text: string | null | undefined): string => (text ? decodeHtmlEntities(text) : "");

// ── Category colours matching globals.css tokens ─────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Job:         { bg: "#D6E8DD",         color: "#1F5A3A", label: "Job" },
  Hackathon:   { bg: "var(--lavender)", color: "#4A3F8A", label: "Hackathon" },
  Internship:  { bg: "var(--peach)",    color: "#7A4A1A", label: "Internship" },
  Fellowship:  { bg: "var(--sage)",     color: "#2E5A28", label: "Fellowship" },
  Scholarship: { bg: "var(--blue)",     color: "#1F4A62", label: "Scholarship" },
  Grant:       { bg: "#E8D5C4",         color: "#6B3F1F", label: "Grant" },
  Event:       { bg: "#F0E8FF",         color: "#5B3D8A", label: "Event" },
};

// ── Gradient avatar backgrounds ───────────────────────────────────────────
const AVATAR_GRADIENTS: Record<string, string> = {
  Job:         "linear-gradient(135deg, #BFE0CC 0%, #5FA37B 100%)",
  Hackathon:   "linear-gradient(135deg, #D2C9EE 0%, #8B7DC7 100%)",
  Internship:  "linear-gradient(135deg, #F0C6A0 0%, #C98A4B 100%)",
  Fellowship:  "linear-gradient(135deg, #B3CDA8 0%, #6E9463 100%)",
  Scholarship: "linear-gradient(135deg, #ACCEDF 0%, #5D8BA3 100%)",
  Grant:       "linear-gradient(135deg, #E8D5C4 0%, #B8946C 100%)",
  Event:       "linear-gradient(135deg, #E8D0FF 0%, #9B6CC7 100%)",
};

// ── Deadline urgency helper ───────────────────────────────────────────────
function getUrgencyStyle(deadline: string | null, deadlineKind: string | null) {
  if (!deadline || !deadlineKind || !["verified", "source_provided"].includes(deadlineKind)) return null;
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const diff = dl - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { label: "Expired", style: { background: "#F1F5F9", color: "#64748B" } };
  if (days <= 3)  return { label: `${days}d left`, style: { background: "#FEE2E2", color: "#991B1B" } };
  if (days <= 14) return { label: `${days}d left`, style: { background: "#FEF3C7", color: "#92400E" } };
  return null; // no urgency badge for far-future deadlines
}

// ── Format date helper ────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch {
    return null;
  }
}

// ── OG Image fallback hook ────────────────────────────────────────────────
function useOgImageFallback(opp: OpportunityDocument, primaryImgFailed: boolean) {
  const [ogImage, setOgImage] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const sourceUrl = opp.sourceUrl || opp.applicationLink || opp.officialSourceUrl;

  const fetchOg = useCallback(async () => {
    if (ogImage || fetching || !sourceUrl) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/og-image?url=${encodeURIComponent(sourceUrl)}`);
      const data = await res.json();
      if (data.imageUrl) {
        setOgImage(data.imageUrl);
      }
    } catch {
      // silently fail
    }
  }, [sourceUrl, ogImage, fetching]);

  // Trigger OG fetch when primary image fails
  useEffect(() => {
    if (primaryImgFailed && sourceUrl) {
      fetchOg();
    }
  }, [primaryImgFailed, sourceUrl, fetchOg]);

  return ogImage;
}

// ── Image fallback avatar ─────────────────────────────────────────────────
function OrgAvatar({ org, category }: { org: string; category: string }) {
  // Get 1-2 letter initials from organization name
  const initials = (() => {
    const words = org.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    if (words.length === 1 && words[0].length >= 2) return words[0].substring(0, 2).toUpperCase();
    return org.substring(0, 2).toUpperCase();
  })();
  const gradient = AVATAR_GRADIENTS[category] ?? AVATAR_GRADIENTS.Event;
  return (
    <div
      className="h-36 w-full rounded-xl flex flex-col items-center justify-center mb-4 overflow-hidden gap-1"
      style={{ background: gradient }}
      aria-hidden="true"
    >
      <span
        className="font-display font-bold select-none"
        style={{ fontSize: "2.5rem", color: "rgba(255,255,255,0.85)", lineHeight: 1 }}
      >
        {initials}
      </span>
      <span
        className="font-mono select-none uppercase"
        style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}
      >
        {category}
      </span>
    </div>
  );
}

export default function OpportunityCard({ opportunity }: { opportunity: OpportunityDocument }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [ogFailed, setOgFailed] = useState(false);
  const cat = CATEGORY_STYLES[opportunity.category] ?? CATEGORY_STYLES.Event;
  const urgency = getUrgencyStyle(opportunity.deadline, opportunity.deadlineKind);
  const deadlineLabel = fmtDate(opportunity.applicationDeadline || opportunity.deadline);
  const eventDateLabel = fmtDate(opportunity.eventDate);
  const isVerifiedDeadline = ["verified", "source_provided"].includes(opportunity.deadlineKind ?? "");
  const hasPrimaryImage = Boolean(opportunity.imageUrl) && !imgError;

  // OG image fallback
  const ogImage = useOgImageFallback(opportunity, imgError);
  const hasOgImage = Boolean(ogImage) && !ogFailed;
  const showImage = hasPrimaryImage || hasOgImage;

  // Is this a newly discovered opportunity (within last 48h)?
  const isNew = (() => {
    const da = (opportunity as any).discoveredAt || opportunity.createdAt;
    if (!da) return false;
    return Date.now() - new Date(da).getTime() < 48 * 3600 * 1000;
  })();

  // Determine best CTA URL — prefer specific URLs over platform homepages
  const ctaUrl = getBestCtaUrl(opportunity);
  const isExternalCta = Boolean(ctaUrl);

  // Source platform display — show org name instead of "Other"
  const rawPlatform = opportunity.sourcePlatform || opportunity.source || null;
  const sourcePlatform = rawPlatform === "Other" ? (opportunity.source || opportunity.organization || null) : rawPlatform;
  const isRolling = opportunity.deadlineKind === "rolling";

  // Category-aware CTA label
  const ctaLabel = (() => {
    const cat = opportunity.category;
    if (cat === "Event" || cat === "Hackathon") return "Register →";
    if (cat === "Job" || cat === "Internship") return "Apply →";
    if (cat === "Fellowship" || cat === "Scholarship" || cat === "Grant") return "Learn more →";
    return "View details →";
  })();

  return (
    <div
      className="relative surface lift flex flex-col overflow-hidden"
      style={{ padding: 0 }}
    >
      {/* Save + Share buttons — absolute positioned */}
      <div className="absolute right-3.5 top-3.5 z-10 flex items-center gap-1">
        <ShareButton
          title={opportunity.title}
          url={`https://oppy.dev/opportunity/${opportunity._id}`}
          organization={opportunity.organization}
        />
        <SaveButton id={opportunity._id} />
      </div>

      <Link href={`/opportunity/${opportunity._id}`} className="group flex flex-col h-full p-5" target="_self">
        {/* ── Image or avatar ──── */}
        {showImage ? (
          <div className="relative w-full rounded-xl mb-4 overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--card)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hasPrimaryImage ? opportunity.imageUrl! : ogImage!}
              alt={opportunity.imageAlt || `${opportunity.title} cover`}
              loading="lazy"
              className="w-full h-full object-contain"
              style={{ maxHeight: '100%' }}
              onError={() => {
                if (hasPrimaryImage) setImgError(true);
                else setOgFailed(true);
              }}
            />
          </div>
        ) : (
          <OrgAvatar org={opportunity.organization} category={opportunity.category} />
        )}

        {/* ── Meta row ──── */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {/* Category pill */}
          <span
            className="inline-block text-[0.68rem] font-semibold px-2 py-0.5 rounded-full"
            style={{ fontFamily: "'JetBrains Mono', monospace", background: cat.bg, color: cat.color, letterSpacing: "0.02em" }}
          >
            {cat.label}
          </span>
          {/* Source badge */}
          {sourcePlatform && (
            <span className="eyebrow" style={{ fontSize: "0.65rem" }}>
              via {d(sourcePlatform)}
            </span>
          )}
          {/* NEW badge */}
          {isNew && (
            <span
              className="inline-block text-[0.65rem] font-semibold px-2 py-0.5 rounded-full"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: "var(--lavender-deep)", color: "white" }}
            >
              NEW
            </span>
          )}
          {/* Deadline countdown */}
          <DeadlineCountdown
            deadline={opportunity.applicationDeadline || opportunity.deadline}
            deadlineKind={opportunity.deadlineKind}
            compact
          />
          {/* Quality score */}
          {(opportunity as any).qualityScore && (opportunity as any).qualityScore >= 80 && (
            <span
              className="inline-block text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: "#D1FAE5",
                color: "#065F46",
              }}
            >
              ✓ Verified
            </span>
          )}
          {/* Urgency badge */}
          {urgency && (
            <span
              className="inline-block text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ml-auto"
              style={{ fontFamily: "'JetBrains Mono', monospace", ...urgency.style }}
            >
              {urgency.label}
            </span>
          )}
        </div>

        {/* ── Org + Title ──── */}
        <p className="eyebrow truncate" style={{ fontSize: "0.68rem" }}>
          <button
            type="button"
            className="hover:underline bg-transparent border-none p-0 cursor-pointer"
            style={{ color: "var(--lavender-deep)", font: "inherit", fontSize: "inherit" }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/org/${encodeURIComponent(opportunity.organization)}`);
            }}
          >
            {d(opportunity.organization)}
          </button>
        </p>
        <h3
          className="mt-0.5 font-display font-semibold leading-snug line-clamp-2 group-hover:text-[var(--lavender-deep)] transition-colors"
          style={{ fontSize: "1rem", color: "var(--ink)" }}
        >
          {d(opportunity.title)}
        </h3>

        {/* ── Location + mode ──── */}
        {(opportunity.location || opportunity.isRemote) && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            {opportunity.isRemote ? "🌐 Remote" : `📍 ${d(opportunity.location)}`}
          </p>
        )}

        {/* ── Dates ──── */}
        <div className="mt-2 space-y-0.5">
          {eventDateLabel && (
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              <span className="eyebrow" style={{ fontSize: "0.62rem" }}>Event</span>{" "}
              {eventDateLabel}
            </p>
          )}
          {isVerifiedDeadline && deadlineLabel ? (
            <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
              <span className="eyebrow" style={{ fontSize: "0.62rem" }}>Deadline</span>{" "}
              {deadlineLabel}
            </p>
          ) : isRolling ? (
            <p className="text-xs" style={{ color: "var(--sage-deep)" }}>
              <span className="eyebrow" style={{ fontSize: "0.62rem" }}>Deadline</span>{" "}
              Rolling / Open
            </p>
          ) : null /* Do NOT show unavailable deadline on cards */}
        </div>

        {/* ── Tags ──── */}
        {opportunity.tags && opportunity.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {opportunity.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="chip" style={{ fontSize: "0.65rem", padding: "0.18rem 0.55rem" }}>
                {d(tag)}
              </span>
            ))}
          </div>
        )}

        {/* ── CTA ──── */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          {isExternalCta ? (
            <span
              className="text-xs font-medium cursor-pointer"
              style={{ color: "var(--lavender-deep)", fontFamily: "'Space Grotesk', sans-serif" }}
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(ctaUrl!, "_blank", "noopener,noreferrer");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(ctaUrl!, "_blank", "noopener,noreferrer");
                }
              }}
            >
              {ctaLabel}
            </span>
          ) : (
            <span
              className="text-xs font-medium"
              style={{ color: "var(--lavender-deep)", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              View details →
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
