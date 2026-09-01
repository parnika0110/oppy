"use client";

import { useState, useEffect } from "react";

/**
 * DeadlineCountdown — Shows a live countdown to an opportunity deadline.
 * Displays days/hours/minutes remaining with urgency coloring.
 */
export default function DeadlineCountdown({
  deadline,
  deadlineKind,
  compact = false,
}: {
  deadline: string | null | undefined;
  deadlineKind?: string | null;
  compact?: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!deadline) return null;
  if (deadlineKind && !["verified", "source_provided"].includes(deadlineKind)) return null;

  const dl = new Date(deadline).getTime();
  const diff = dl - now;

  if (diff < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          background: "#F1F5F9",
          color: "#64748B",
        }}
      >
        Expired
      </span>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  let label: string;
  let bg: string;
  let color: string;

  if (days === 0) {
    label = `${hours}h left`;
    bg = "#FEE2E2";
    color = "#991B1B";
  } else if (days === 1) {
    label = "1d left";
    bg = "#FEE2E2";
    color = "#991B1B";
  } else if (days <= 3) {
    label = `${days}d left`;
    bg = "#FEF3C7";
    color = "#92400E";
  } else if (days <= 7) {
    label = `${days}d left`;
    bg = "#FEF3C7";
    color = "#92400E";
  } else if (days <= 14) {
    label = `${days}d left`;
    bg = "#F0F9FF";
    color = "#1E40AF";
  } else {
    if (compact) return null;
    label = `${days}d left`;
    bg = "var(--accent)";
    color = "var(--accent-deep)";
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: bg,
        color: color,
      }}
    >
      ⏰ {label}
    </span>
  );
}
