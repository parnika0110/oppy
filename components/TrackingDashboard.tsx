"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import ApplicationTracker from "./ApplicationTracker";
import ThemedOppyOrb from "./ThemedOppyOrb";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "interested", label: "Interested", emoji: "◉" },
  { key: "applied", label: "Applied", emoji: "✓" },
  { key: "interview", label: "Interview", emoji: "🎤" },
  { key: "accepted", label: "Accepted", emoji: "🎉" },
  { key: "rejected", label: "Rejected", emoji: "✗" },
] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  interested: { bg: "#FEF3C7", text: "#92400E" },
  applied: { bg: "#D1FAE5", text: "#065F46" },
  interview: { bg: "#DBEAFE", text: "#1E40AF" },
  accepted: { bg: "#D1FAE5", text: "#065F46" },
  rejected: { bg: "#FEE2E2", text: "#991B1B" },
};

interface TrackingEntry {
  _id: string;
  opportunityId: string;
  status: string;
  updatedAt: string;
  opportunity: {
    _id: string;
    title: string;
    organization: string;
    location?: string;
    category?: string;
    isRemote?: boolean;
    applicationLink?: string;
    sourceUrl?: string;
    lifecycleStatus?: string;
    isActive?: boolean;
    deadline?: string | null;
    applicationDeadline?: string | null;
    deadlineKind?: string;
  } | null;
}

/**
 * Whether the tracked opportunity is no longer actionable (closed by the
 * lifecycle pipeline or archived). It stays in tracking history — we never
 * delete it — but is visually marked as not-open rather than looking live.
 */
function isNotActionable(opp: NonNullable<TrackingEntry["opportunity"]>): boolean {
  return opp.lifecycleStatus === "closed" || opp.lifecycleStatus === "archived" || opp.isActive === false;
}

/**
 * Show a verified application deadline when the source provided one.
 * Never infers a deadline from event dates or posting dates.
 */
function deadlineLabel(opp: NonNullable<TrackingEntry["opportunity"]>): string | null {
  const kind = opp.deadlineKind;
  if (!["verified", "source_provided"].includes(kind || "")) return null;
  const raw = opp.applicationDeadline || opp.deadline;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default function TrackingDashboard({ standalone = false }: { standalone?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<TrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  const loadTracking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tracking");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadTracking();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, loadTracking]);

  if (authLoading || !user) return null;

  // Count by status
  const counts: Record<string, number> = {};
  for (const e of entries) {
    counts[e.status] = (counts[e.status] || 0) + 1;
  }

  const filtered = activeFilter === "all"
    ? entries
    : entries.filter((e) => e.status === activeFilter);

  // Embedded on the dashboard: hide the whole section when there is nothing
  // tracked yet. On the standalone /dashboard/applications page we always
  // render so the empty state + CTA are visible.
  if (!standalone && !loading && entries.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="font-display font-semibold"
          style={{ fontSize: "1.15rem", color: "var(--ink)" }}
        >
          Your applications
        </h2>
        {!standalone && entries.length > 0 && (
          <Link
            href="/dashboard/applications"
            className="text-xs font-medium underline-hover transition-colors"
            style={{ color: "var(--ink-soft)" }}
          >
            View all →
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-16 rounded-full skeleton" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div
          className="flex items-center justify-between py-4 px-5 rounded-xl"
          style={{ background: "var(--card)", border: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-3">
            <ThemedOppyOrb mood="curious" size={28} />
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Nothing tracked yet.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-xs font-medium px-4 py-2 rounded-full transition-opacity hover:opacity-85"
            style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Browse opportunities →
          </Link>
        </div>
      ) : (
        <>
          {/* Status count pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {STATUS_FILTERS.map((f) => {
              const count = f.key === "all" ? entries.length : (counts[f.key] || 0);
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveFilter(f.key)}
                  className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    background: isActive ? "var(--ink)" : "var(--card)",
                    color: isActive ? "var(--paper)" : "var(--ink-soft)",
                    border: isActive ? "none" : "1px solid var(--line)",
                  }}
                >
                  {'emoji' in f && f.emoji && <span>{f.emoji}</span>}
                  {f.label}
                  {count > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[0.6rem] font-bold px-1"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.25)" : "var(--paper-2, #f0ecf9)",
                        color: isActive ? "var(--paper)" : "var(--ink-soft)",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tracked opportunities list */}
          {filtered.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--ink-soft)" }}>
              No opportunities with this status.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => {
                const opp = entry.opportunity;
                const sc = STATUS_COLORS[entry.status] || STATUS_COLORS.interested;
                return (
                  <div
                    key={entry._id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--line)",
                      opacity: opp && isNotActionable(opp) ? 0.72 : 1,
                    }}
                  >
                    {/* Status badge */}
                    <span
                      className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        background: sc.bg,
                        color: sc.text,
                      }}
                    >
                      {(STATUS_FILTERS.find((f) => f.key === entry.status) as any)?.emoji}{" "}
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>

                    {/* Opportunity info */}
                    <div className="flex-1 min-w-0">
                      {opp ? (
                        <>
                          <Link
                            href={`/opportunity/${opp._id}`}
                            className="block hover:underline"
                            style={{ color: "var(--ink)" }}
                          >
                            <p className="text-sm font-medium line-clamp-1">{opp.title}</p>
                            <p className="text-xs line-clamp-1" style={{ color: "var(--ink-soft)" }}>
                              {opp.organization}
                              {opp.location && ` · ${opp.isRemote ? "Remote" : opp.location}`}
                            </p>
                            {deadlineLabel(opp) && (
                              <p className="text-[0.62rem] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                                Deadline: {deadlineLabel(opp)}
                              </p>
                            )}
                          </Link>
                          {opp.category && (
                            <span className="text-[0.6rem] font-semibold uppercase tracking-wide mt-1 inline-block" style={{ color: "var(--ink-soft)" }}>
                              {opp.category}
                            </span>
                          )}
                          {isNotActionable(opp) && (
                            <span
                              className="inline-flex items-center text-[0.62rem] font-semibold px-2 py-0.5 rounded-full ml-2 align-baseline"
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                background: "var(--paper-2, #f0ecf9)",
                                color: "var(--ink-soft)",
                              }}
                            >
                              {opp.lifecycleStatus === "archived" ? "Archived" : "Closed"}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                          Opportunity no longer available
                        </p>
                      )}
                    </div>

                    {/* Tracker control */}
                    <div className="shrink-0">
                      <ApplicationTracker
                        opportunityId={entry.opportunityId}
                        currentStatus={entry.status}
                        onStatusChange={(newStatus) => {
                          setEntries((prev) =>
                            prev.map((e) =>
                              e.opportunityId === entry.opportunityId
                                ? { ...e, status: newStatus }
                                : e
                            )
                          );
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
