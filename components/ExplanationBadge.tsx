"use client";

/**
 * Small badge shown under recommended opportunity cards.
 * Explains *why* this opportunity was recommended for the current user.
 *
 * Uses the same design language as category chips but with a subtle lavender tint.
 */
export default function ExplanationBadge({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[0.62rem] font-medium px-2 py-0.5 rounded-full"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: "var(--accent)",
        color: "var(--accent-deep)",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ fontSize: "0.55rem" }}>✦</span>
      {text}
    </span>
  );
}
