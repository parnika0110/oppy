"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface RunRecord {
  _id: string;
  source: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: string[];
  status: "success" | "error" | "empty";
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    success: { bg: "#DCFCE7", color: "#166534" },
    error: { bg: "#FEE2E2", color: "#991B1B" },
    empty: { bg: "#F1F5F9", color: "#64748B" },
  };
  const c = colors[status] || colors.empty;
  return (
    <span
      className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: c.bg,
        color: c.color,
      }}
    >
      {status}
    </span>
  );
}

export default function AdminRunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/runs");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      } else {
        setError("Failed to load run history.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="font-display font-semibold"
            style={{ fontSize: "1.5rem", color: "var(--ink)" }}
          >
            Discovery Runs
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            History of all ingestion pipeline executions. Data comes directly
            from the ingestionRuns collection.
          </p>
        </div>
        <a
          href="/admin"
          className="text-sm underline-hover"
          style={{ color: "var(--lavender-deep)" }}
        >
          ← Back to Admin
        </a>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton h-14 rounded-xl"
              style={{ border: "1px solid var(--line)" }}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div
          className="py-16 text-center rounded-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--line)" }}
        >
          <p
            className="font-display font-semibold text-lg"
            style={{ color: "var(--ink)" }}
          >
            No runs yet
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--ink-soft)" }}
          >
            Run the discovery pipeline from the admin dashboard to see
            execution history here.
          </p>
          <a
            href="/admin"
            className="mt-4 inline-block text-sm font-medium px-4 py-2 rounded-full"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Go to Admin Dashboard →
          </a>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--line)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "800px" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--line)",
                    background: "var(--paper-2)",
                  }}
                >
                  {[
                    "Source",
                    "Started",
                    "Finished",
                    "Duration",
                    "Fetched",
                    "Published",
                    "Rejected",
                    "Duplicates",
                    "Errors",
                    "Status",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.65rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                        fontWeight: 500,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run._id}
                    style={{
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <td
                      className="px-4 py-3 font-medium"
                      style={{ color: "var(--ink)", fontSize: "0.85rem" }}
                    >
                      {run.source}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {fmt(run.startedAt)}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {fmt(run.completedAt)}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {fmtDuration(run.durationMs)}
                    </td>
                    <td
                      className="px-4 py-3 font-semibold"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "#3B82F6",
                      }}
                    >
                      {run.fetched}
                    </td>
                    <td
                      className="px-4 py-3 font-semibold"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "#16A34A",
                      }}
                    >
                      {run.inserted}
                    </td>
                    <td
                      className="px-4 py-3 font-semibold"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "#DC2626",
                      }}
                    >
                      {run.failed}
                    </td>
                    <td
                      className="px-4 py-3 font-semibold"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "#CA8A04",
                      }}
                    >
                      {run.skipped}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.75rem",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {run.errors.length > 0 ? (
                        <span
                          title={run.errors.join("\n")}
                          className="cursor-help"
                        >
                          {run.errors.length}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={run.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-4 text-sm pt-4" style={{ borderTop: "1px solid var(--line)" }}>
        <a href="/admin" className="underline-hover" style={{ color: "var(--lavender-deep)" }}>
          ← Admin
        </a>
        <a href="/admin/sources" className="underline-hover" style={{ color: "var(--lavender-deep)" }}>
          Source Health →
        </a>
      </div>
    </div>
  );
}
