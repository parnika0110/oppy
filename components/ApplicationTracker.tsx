"use client";

import { useState } from "react";

const STATUSES = [
  // "saved" is handled by the bookmark button — removed from tracker UI
  // but kept in the backend so existing data still displays correctly.
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
  const [status, setStatus] = useState<Status>((currentStatus as Status) || "interested");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newStatus: Status) {
    if (newStatus === status) return;
    setSaving(true);
    setError(null);
    const previousStatus = status;
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      } else {
        // Revert to previous status — don't let UI show a state the server rejected
        setStatus(previousStatus);
        setError("Couldn't save. Try again.");
        setTimeout(() => setError(null), 3000);
      }
    } catch {
      setStatus(previousStatus);
      setError("Network error.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
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
      {error && (
        <p
          className="mt-1.5 text-[0.6rem]"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: "#991B1B" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
