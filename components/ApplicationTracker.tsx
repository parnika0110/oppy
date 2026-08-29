"use client";

import { useState } from "react";

const STATUSES = [
  { key: "saved", label: "📌 Saved", color: "var(--lavender)", textColor: "#4A3F8A" },
  { key: "interested", label: "👀 Interested", color: "#FEF3C7", textColor: "#92400E" },
  { key: "applied", label: "✅ Applied", color: "#D1FAE5", textColor: "#065F46" },
  { key: "interview", label: "🎤 Interview", color: "#DBEAFE", textColor: "#1E40AF" },
  { key: "accepted", label: "🎉 Accepted", color: "#D1FAE5", textColor: "#065F46" },
  { key: "rejected", label: "❌ Rejected", color: "#FEE2E2", textColor: "#991B1B" },
] as const;

type Status = (typeof STATUSES)[number]["key"];

/**
 * ApplicationTracker — Status buttons for tracking application progress.
 * Appears on saved opportunity cards.
 */
export default function ApplicationTracker({
  opportunityId,
  currentStatus,
  onStatusChange,
}: {
  opportunityId: string;
  currentStatus?: string;
  onStatusChange?: (status: string) => void;
}) {
  const [status, setStatus] = useState<Status>((currentStatus as Status) || "saved");
  const [saving, setSaving] = useState(false);

  async function handleChange(newStatus: Status) {
    if (newStatus === status) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUSES.map((s) => (
        <button
          key={s.key}
          onClick={() => handleChange(s.key)}
          disabled={saving}
          className="text-[0.6rem] font-semibold px-2 py-1 rounded-full transition-all"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            background: status === s.key ? s.color : "transparent",
            color: status === s.key ? s.textColor : "var(--ink-soft)",
            border: status === s.key ? "none" : "1px solid var(--line)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
