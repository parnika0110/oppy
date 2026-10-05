"use client";

/**
 * VoiceResults — grouped, ranked REAL OPPY opportunities for a voice query.
 *
 * Cards are OPPY's own OpportunityCard, so saving, sharing, deadline
 * countdowns, Apply/CTA links and detail-page routing behave exactly as in
 * browse results (same /api/saved API, same /opportunity/[id] records).
 */

import Link from "next/link";
import OpportunityCard from "@/components/OpportunityCard";
import type {
  VoiceDiscoverResponse,
  VoiceResultGroup,
  VoiceResultItem,
} from "@/types/voice";

const LEVEL_STYLES: Record<VoiceResultItem["matchLevel"], { background: string; color: string }> = {
  strong: { background: "#D6E8DD", color: "#1F5A3A" },
  good: { background: "var(--lavender)", color: "#4A3F8A" },
  related: { background: "var(--blue)", color: "#1F4A62" },
  broad: { background: "var(--paper-2)", color: "var(--ink-soft)" },
};

function ResultCard({ item }: { item: VoiceResultItem }) {
  const levelStyle = LEVEL_STYLES[item.matchLevel] || LEVEL_STYLES.broad;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="chip" style={{ ...levelStyle, fontWeight: 600 }}>
          {item.matchPercent}% match
        </span>
        {item.matchLabels.map((label) => (
          <span key={label} className="chip" style={{ background: "var(--paper-2)" }}>
            {label}
          </span>
        ))}
      </div>
      <OpportunityCard opportunity={item.opportunity} />
    </div>
  );
}

function GroupSection({ group }: { group: VoiceResultGroup }) {
  if (group.items.length === 0) return null;
  return (
    <section className="mb-8" aria-label={group.heading}>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-display text-lg" style={{ fontWeight: 700 }}>
          {group.heading}
        </h2>
        <span className="font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
          {group.items.length}
        </span>
      </div>
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
        {group.items.map((item) => (
          <ResultCard key={item.opportunity._id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default function VoiceResults({ result }: { result: VoiceDiscoverResponse }) {
  const hasResults = result.total > 0;

  return (
    <section className="mt-6" aria-label="Voice search results">
      {/* Header: summary + browse link + transparency note */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="eyebrow mb-1">What OPPY found</p>
          <p className="font-display text-lg" style={{ fontWeight: 700 }}>
            {result.summary}
          </p>
          {result.excluded > 0 && (
            <p className="font-mono text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
              {result.excluded} unrelated result{result.excluded === 1 ? "" : "s"} filtered out by
              OPPY&rsquo;s relevance engine
            </p>
          )}
        </div>
        <Link
          href={result.browseUrl}
          className="chip underline-hover cursor-pointer"
          style={{ textDecoration: "none" }}
        >
          See all in Browse →
        </Link>
      </div>

      {hasResults ? (
        result.groups.map((group) => <GroupSection key={group.heading} group={group} />)
      ) : (
        <div className="surface p-6 text-center">
          <p className="font-display text-lg mb-2" style={{ fontWeight: 700 }}>
            Nothing matched this time.
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
            {result.summary} Try fewer filters, a different keyword, or tap the mic again.
          </p>
          <a
            href={result.browseUrl}
            className="chip underline-hover"
            style={{ textDecoration: "none" }}
          >
            Browse everything →
          </a>
        </div>
      )}

      {hasResults && (
        <p className="font-mono text-xs text-center mt-2" style={{ color: "var(--ink-soft)" }}>
          Results come from OPPY&rsquo;s live opportunity database · {result.tookMs}ms
        </p>
      )}
    </section>
  );
}
