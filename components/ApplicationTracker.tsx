"use client";

import { useState, useRef, useEffect } from "react";
import { isApplicationTracked } from "@/lib/tracking-state";

const STATUSES = [
  { key: "interested", label: "Interested", emoji: "◉", color: "#FEF3C7", textColor: "#92400E" },
  { key: "applied", label: "Applied", emoji: "✓", color: "#D1FAE5", textColor: "#065F46" },
  { key: "interview", label: "Interview", emoji: "🎤", color: "#DBEAFE", textColor: "#1E40AF" },
  { key: "accepted", label: "Accepted", emoji: "🎉", color: "#D1FAE5", textColor: "#065F46" },
  { key: "rejected", label: "Rejected", emoji: "✗", color: "#FEE2E2", textColor: "#991B1B" },
] as const;

type Status = (typeof STATUSES)[number]["key"];

function getStatusConfig(status: string) {
  return STATUSES.find((s) => s.key === status) || STATUSES[0];
}

/**
 * ApplicationTracker — Compact tracking control for opportunity cards.
 *
 * Untracked: "+ Track" button
 * Tracked: status badge that opens a popup selector on click.
 *
 * Also used on the detail page and saved page.
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
  const [locallyStarted, setLocallyStarted] = useState(false);
  const isTracked = isApplicationTracked(currentStatus, locallyStarted);
  const [showPopup, setShowPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync when parent provides updated status
  useEffect(() => {
    if (currentStatus && currentStatus !== "saved") {
      setStatus(currentStatus as Status);
    }
  }, [currentStatus]);

  // Close popup on outside click
  useEffect(() => {
    if (!showPopup) return;
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setShowPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopup]);

  async function handleChange(newStatus: Status) {
    if (newStatus === status && isTracked) {
      setShowPopup(false);
      return;
    }
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
        // Mark the tracker as started locally so the badge shows immediately,
        // even though currentStatus (fetched before this POST) is still stale.
        setLocallyStarted(true);
        onStatusChange?.(newStatus);
        setShowPopup(false);
      } else {
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

  const config = getStatusConfig(status);

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!isTracked) {
            // First track — default to "interested"
            handleChange("interested");
          } else {
            setShowPopup(!showPopup);
          }
        }}
        disabled={saving}
        className="inline-flex items-center gap-1 text-[0.68rem] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          background: isTracked ? config.color : "transparent",
          color: isTracked ? config.textColor : "var(--ink-soft)",
          border: isTracked ? "none" : "1px solid var(--line)",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "…" : isTracked ? `${config.emoji} ${config.label}` : "+ Track"}
      </button>

      {/* Status selector popup */}
      {showPopup && (
        <div
          ref={popupRef}
          className="absolute left-0 bottom-full mb-2 z-50 rounded-xl border border-stone-200 bg-white shadow-lg p-1.5 min-w-[140px]"
        >
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => handleChange(s.key)}
              disabled={saving}
              className="w-full text-left px-3 py-1.5 rounded-lg text-[0.7rem] font-medium transition-colors flex items-center gap-2 cursor-pointer"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: status === s.key ? s.color : "transparent",
                color: status === s.key ? s.textColor : "var(--ink-soft)",
              }}
            >
              <span style={{ width: 16, textAlign: "center" }}>{s.emoji}</span>
              {s.label}
            </button>
          ))}
          {error && (
            <p className="px-3 pt-1 text-[0.6rem] text-red-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
