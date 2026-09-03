"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { OpportunityDocument } from "@/types/opportunity";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";
import DeadlineCountdown from "./DeadlineCountdown";
import { getBestCtaUrl } from "@/lib/url-utils";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { isLowQualityImageUrl } from "@/lib/images";
import { extractStipend, extractDuration } from "@/lib/card-metadata";

// Display-time decoder — ensures existing DB records with encoded entities render cleanly
const d = (text: string | null | undefined): string => (text ? decodeHtmlEntities(text) : "");

// Minimum image file size (bytes) heuristic for card display.
// Very small files are almost certainly icons/logos.
const MIN_CARD_IMAGE_BYTES = 2048;

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
  const [fetched, setFetched] = useState(false);

  const sourceUrl = opp.sourceUrl || opp.applicationLink || opp.officialSourceUrl;

  const fetchOg = useCallback(async () => {
    if (fetching || fetched || !sourceUrl) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/og-image?url=${encodeURIComponent(sourceUrl)}`);
      const data = await res.json();
      if (data.imageUrl) {
        setOgImage(data.imageUrl);
      }
    } catch {
      // silently fail
    } finally {
      setFetched(true);
      setFetching(false);
    }
  }, [sourceUrl, fetched]);

  // Proactively fetch OG image when no primary image exists (avoid flash)
  useEffect(() => {
    if (!opp.imageUrl && sourceUrl && !fetched && !fetching) {
      fetchOg();
    }
  }, [opp.imageUrl, sourceUrl, fetched, fetching, fetchOg]);

  // Also fetch on primary image failure
  useEffect(() => {
    if (primaryImgFailed && sourceUrl && !fetched && !fetching) {
      fetchOg();
    }
  }, [primaryImgFailed, sourceUrl, fetched, fetching, fetchOg]);

  return ogImage;
}

// ── Category-specific OPPY-generated fallback art ─────────────────────────
const CATEGORY_ICONS: Record<string, { emoji: string; gradient: string }> = {
  Job:         { emoji: "💼", gradient: "linear-gradient(135deg, #BFE0CC 0%, #5FA37B 100%)" },
  Internship:  { emoji: "🎓", gradient: "linear-gradient(135deg, #F0C6A0 0%, #C98A4B 100%)" },
  Hackathon:   { emoji: "⚡", gradient: "linear-gradient(135deg, #D2C9EE 0%, #8B7DC7 100%)" },
  Fellowship:  { emoji: "🌟", gradient: "linear-gradient(135deg, #B3CDA8 0%, #6E9463 100%)" },
  Scholarship: { emoji: "🏆", gradient: "linear-gradient(135deg, #ACCEDF 0%, #5D8BA3 100%)" },
  Grant:       { emoji: "💰", gradient: "linear-gradient(135deg, #E8D5C4 0%, #B8946C 100%)" },
  Event:       { emoji: "📅", gradient: "linear-gradient(135deg, #E8D0FF 0%, #9B6CC7 100%)" },
};

function OrgAvatar({ org, category }: { org: string; category: string }) {
  const { emoji, gradient } = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.Event;
  return (
    <div
      className="w-full rounded-xl flex flex-col items-center justify-center mb-3 overflow-hidden gap-2"
      style={{ aspectRatio: '16/9', background: gradient }}
      aria-hidden="true"
    >
      <span className="select-none" style={{ fontSize: "2.2rem", lineHeight: 1 }}>
        {emoji}
      </span>
      <span
        className="font-mono select-none uppercase"
        style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em" }}
      >
        {category}
      </span>
    </div>
  );
}

export default function OpportunityCard({ opportunity, variant }: { opportunity: OpportunityDocument; variant?: "default" | "similar" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [imgError, setImgError] = useState(false);
  const [ogFailed, setOgFailed] = useState(false);
  const cat = CATEGORY_STYLES[opportunity.category] ?? CATEGORY_STYLES.Event;
  const urgency = getUrgencyStyle(opportunity.deadline, opportunity.deadlineKind);
  const deadlineLabel = fmtDate(opportunity.applicationDeadline || opportunity.deadline);
  const eventDateLabel = fmtDate(opportunity.eventDate);
  const isVerifiedDeadline = ["verified", "source_provided"].includes(opportunity.deadlineKind ?? "");
  // Reject low-quality image URLs (tiny logos, icons, thumbnails)
  const isLowQualityUrl = Boolean(opportunity.imageUrl && isLowQualityImageUrl(opportunity.imageUrl));
  const hasPrimaryImage = Boolean(opportunity.imageUrl) && !imgError && !isLowQualityUrl;

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

  // Structured metadata — prefer stored fields, fall back to description extraction
  const stipend = opportunity.stipend || extractStipend(opportunity.description);
  const duration = opportunity.duration || extractDuration(opportunity.description);

  // Category-aware CTA label
  const ctaLabel = (() => {
    const cat = opportunity.category;
    if (cat === "Event" || cat === "Hackathon") return "Register →";
    if (cat === "Job" || cat === "Internship") return "Apply →";
    if (cat === "Fellowship" || cat === "Scholarship" || cat === "Grant") return "Learn more →";
    return "View details →";
  })();

  const isSimilar = variant === "similar";
  const cardUrl = `/opportunity/${opportunity._id}?from=${encodeURIComponent(pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""))}`;

  // ── Similar Opportunities compact variant ──────────────────────────────
  if (isSimilar) {
    return (
      <div className="relative surface lift flex flex-col overflow-hidden" style={{ padding: 0 }}>
        <Link href={cardUrl} className="group flex flex-col" target="_self">
          {/* Thumbnail — always 16:9 */}
          {showImage ? (
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--paper-2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hasPrimaryImage ? opportunity.imageUrl! : ogImage!}
                alt={opportunity.imageAlt || `${opportunity.title} cover`}
                loading="lazy"
                className="w-full h-full object-cover"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const w = img.naturalWidth;
                  const h = img.naturalHeight;
                  if (w > 0 && h > 0) {
                    const aspectRatio = w / h;
                    if (w < 100 || h < 60 || aspectRatio > 3 || aspectRatio < 0.3) {
                      if (hasPrimaryImage) setImgError(true);
                      else setOgFailed(true);
                    }
                  }
                }}
                onError={() => {
                  if (hasPrimaryImage) setImgError(true);
                  else setOgFailed(true);
                }}
              />
            </div>
          ) : (
            <OrgAvatar org={opportunity.organization} category={opportunity.category} />
          )}

          <div className="p-3.5">
            {/* Category + source */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span
                className="inline-block text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: cat.bg, color: cat.color }}
              >
                {cat.label}
              </span>
              {sourcePlatform && (
                <span className="text-[0.6rem]" style={{ color: 'var(--ink-soft)' }}>
                  · {d(sourcePlatform)}
                </span>
              )}
              {(opportunity as any).qualityScore && (opportunity as any).qualityScore >= 80 && (
                <span className="text-[0.55rem]" style={{ color: '#065F46' }}>✓</span>
              )}
            </div>

            {/* Organization */}
            <p className="text-[0.7rem] font-medium line-clamp-1" style={{ color: 'var(--accent-deep)' }}>
              {d(opportunity.organization)}
            </p>

            {/* Title — max 2 lines */}
            <h3
              className="mt-0.5 font-display font-semibold leading-snug line-clamp-2 group-hover:text-[var(--accent-deep)] transition-colors"
              style={{ fontSize: '0.88rem', color: 'var(--ink)' }}
            >
              {d(opportunity.title)}
            </h3>

            {/* Location — max 1 line */}
            {(opportunity.location || opportunity.isRemote) && (
              <p className="mt-1 text-[0.7rem] line-clamp-1" style={{ color: 'var(--ink-soft)' }}>
                {opportunity.isRemote ? '🌐 Remote' : `📍 ${d(opportunity.location)}`}
              </p>
            )}

            {/* CTA */}
            <p className="mt-2 text-[0.7rem] font-medium" style={{ color: 'var(--accent-deep)', fontFamily: "'Space Grotesk', sans-serif" }}>
              {ctaLabel}
            </p>
          </div>
        </Link>
      </div>
    );
  }

  // ── Default card variant ──────────────────────────────────────────────
  return (
    <div
      className="relative surface lift flex flex-col overflow-hidden"
      style={{ padding: 0 }}
    >
      {/* Save + Share buttons — absolute positioned */}
      <div className="absolute right-3.5 top-3.5 z-10 flex items-center gap-1">
        <ShareButton
          title={opportunity.title}
          url={`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/opportunity/${opportunity._id}`}
          organization={opportunity.organization}
        />
        <SaveButton id={opportunity._id} />
      </div>

      <Link href={cardUrl} className="group flex flex-col flex-1 p-5" target="_self">
        {/* ── Image or avatar ──── */}
        {showImage ? (
          <div className="relative w-full rounded-xl mb-3 overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--paper-2)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hasPrimaryImage ? opportunity.imageUrl! : ogImage!}
              alt={opportunity.imageAlt || `${opportunity.title} cover`}
              loading="lazy"
              className="w-full h-full object-cover"
              onLoad={(e) => {
                const img = e.currentTarget;
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                if (w > 0 && h > 0) {
                  const aspectRatio = w / h;
                  // Reject images that are too small or have extreme aspect ratios
                  // (logo strips, favicons, tiny icons). Normal card images are ~16:9 (1.78).
                  // Allow 0.3–3.0 to cover portrait, landscape, and square images.
                  const isUnusable = w < 100 || h < 60 || aspectRatio > 3 || aspectRatio < 0.3;
                  if (isUnusable) {
                    if (hasPrimaryImage) setImgError(true);
                    else setOgFailed(true);
                  }
                }
              }}
              onError={() => {
                if (hasPrimaryImage) setImgError(true);
                else setOgFailed(true);
              }}
            />
          </div>
        ) : (
          <OrgAvatar org={opportunity.organization} category={opportunity.category} />
        )}

        {/* ── 1. Type + Source badges ──── */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="inline-block text-[0.68rem] font-semibold px-2 py-0.5 rounded-full"
            style={{ fontFamily: "'JetBrains Mono', monospace", background: cat.bg, color: cat.color, letterSpacing: "0.02em" }}
          >
            {cat.label}
          </span>
          {sourcePlatform && (
            <span className="eyebrow" style={{ fontSize: "0.65rem" }}>
              via {d(sourcePlatform)}
            </span>
          )}
          {isNew && (
            <span
              className="inline-block text-[0.65rem] font-semibold px-2 py-0.5 rounded-full"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: "var(--accent-deep)", color: "white" }}
            >
              NEW
            </span>
          )}
          {(opportunity as any).qualityScore && (opportunity as any).qualityScore >= 80 && (
            <span
              className="inline-block text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: "#D1FAE5", color: "#065F46" }}
            >
              ✓ Verified
            </span>
          )}
          {urgency && (
            <span
              className="inline-block text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ml-auto"
              style={{ fontFamily: "'JetBrains Mono', monospace", ...urgency.style }}
            >
              {urgency.label}
            </span>
          )}
        </div>

        {/* ── 2. Company — clearly readable ──── */}
        <p className="font-medium text-xs" style={{ color: "var(--accent-deep)" }}>
          <button
            type="button"
            className="hover:underline bg-transparent border-none p-0 cursor-pointer"
            style={{ color: "inherit", font: "inherit" }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/org/${encodeURIComponent(opportunity.organization)}`);
            }}
          >
            {d(opportunity.organization)}
          </button>
        </p>

        {/* ── 3. Title — strongest text ──── */}
        <h3
          className="mt-0.5 font-display font-semibold leading-snug line-clamp-2 group-hover:text-[var(--accent-deep)] transition-colors"
          style={{ fontSize: "1.05rem", color: "var(--ink)", minHeight: '2.6em' }}
        >
          {d(opportunity.title)}
        </h3>

        {/* ── 4. Location / remote ──── */}
        {(opportunity.location || opportunity.isRemote) && (
          <p className="mt-1.5 text-xs line-clamp-1" style={{ color: "var(--ink-soft)", minHeight: '1.2em' }}>
            {opportunity.isRemote ? "🌐 Remote" : `📍 ${d(opportunity.location)}`}
          </p>
        )}

        {/* ── 5. Metadata strip: Stipend | Duration | Deadline ──── */}
        {(() => {
          const hasStipend = Boolean(stipend);
          const hasDuration = Boolean(duration);
          const hasDeadline = (isVerifiedDeadline && deadlineLabel) || isRolling || eventDateLabel;
          if (!hasStipend && !hasDuration && !hasDeadline) return null;
          return (
            <div
              className="mt-2.5 grid gap-x-4 gap-y-1 rounded-lg px-3 py-2"
              style={{
                background: 'var(--paper-2)',
                gridTemplateColumns: `repeat(${Math.min([hasStipend, hasDuration, hasDeadline].filter(Boolean).length, 3)}, 1fr)`,
              }}
            >
              {hasStipend && (
                <div style={{ breakInside: 'avoid' }}>
                  <p className="text-[0.6rem] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-soft)', fontFamily: "'JetBrains Mono', monospace" }}>
                    💰 Stipend
                  </p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>
                    {d(stipend)}
                  </p>
                </div>
              )}
              {hasDuration && (
                <div style={{ breakInside: 'avoid' }}>
                  <p className="text-[0.6rem] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-soft)', fontFamily: "'JetBrains Mono', monospace" }}>
                    ⏱ Duration
                  </p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {d(duration)}
                  </p>
                </div>
              )}
              {hasDeadline && (
                <div style={{ breakInside: 'avoid' }}>
                  <p className="text-[0.6rem] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-soft)', fontFamily: "'JetBrains Mono', monospace" }}>
                    📅 Deadline
                  </p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: urgency ? urgency.style.color : 'var(--ink)' }}>
                    {isRolling ? 'Rolling / Open' : eventDateLabel || deadlineLabel}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 6. Tags ──── */}
        {opportunity.tags && opportunity.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {opportunity.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="chip" style={{ fontSize: "0.65rem", padding: "0.18rem 0.55rem" }}>
                {d(tag)}
              </span>
            ))}
          </div>
        )}

        {/* ── 7. CTA ──── */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          {isExternalCta ? (
            <span
              className="text-xs font-medium cursor-pointer"
              style={{ color: "var(--accent-deep)", fontFamily: "'Space Grotesk', sans-serif" }}
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
              style={{ color: "var(--accent-deep)", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              View details →
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
