"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SourceHealth {
  key: string;
  label: string;
  configured: boolean;
  configNote: string | null;
  enabled: boolean;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  runsRecorded: number;
  candidatesFetched: number;
  published: number;
  duplicates: number;
  rejected: number;
  calendars?: string[];
}

function fmt(iso: string | null) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        background: configured ? "#DCFCE7" : "#FEE2E2",
        color: configured ? "#166534" : "#991B1B",
      }}
    >
      {configured ? "Configured" : "Not configured"}
    </span>
  );
}

export default function AdminSourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<SourceHealth[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sources");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources);
      } else {
        setError("Failed to load source health.");
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Source Health</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live configuration and run history for every discovery source. Credentials are never
          shown here — only whether each one is configured.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {sources && (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s.key} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">{s.label}</h2>
                  <StatusPill configured={s.configured} />
                  {!s.enabled && (
                    <span className="text-xs text-gray-400">— cannot run until configured</span>
                  )}
                </div>
                {s.configNote && <span className="text-xs text-gray-400">{s.configNote}</span>}
              </div>

              {s.label === "Luma" && (
                <p className="text-xs text-gray-500 mt-2">
                  Calendars:{" "}
                  {s.calendars && s.calendars.length > 0 ? (
                    <span className="font-mono">{s.calendars.join(", ")}</span>
                  ) : (
                    <span className="italic">
                      none set — LUMA_CALENDARS is empty, so this source returns zero results
                    </span>
                  )}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                <div>
                  <p className="text-gray-400">Last checked</p>
                  <p className="text-gray-800">{fmt(s.lastCheckedAt)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Last success</p>
                  <p className="text-gray-800">{fmt(s.lastSuccessAt)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Last failure</p>
                  <p className="text-gray-800">{fmt(s.lastFailureAt)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Runs recorded</p>
                  <p className="text-gray-800">{s.runsRecorded}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                <div>
                  <p className="text-gray-400">Fetched (all-time)</p>
                  <p className="font-semibold text-blue-600">{s.candidatesFetched}</p>
                </div>
                <div>
                  <p className="text-gray-400">Published</p>
                  <p className="font-semibold text-green-600">{s.published}</p>
                </div>
                <div>
                  <p className="text-gray-400">Duplicates</p>
                  <p className="font-semibold text-yellow-600">{s.duplicates}</p>
                </div>
                <div>
                  <p className="text-gray-400">Rejected</p>
                  <p className="font-semibold text-red-600">{s.rejected}</p>
                </div>
              </div>

              {s.lastError && (
                <p className="text-xs text-red-600 font-mono mt-3 truncate">⚠ {s.lastError}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-400 border-t border-gray-100 pt-4 flex gap-4">
        <a href="/admin" className="text-blue-600 hover:underline">← Back to Admin</a>
        <a href="/admin/ingestion" className="text-blue-600 hover:underline">Run History →</a>
      </div>
    </div>
  );
}
