"use client";

import { useState, useEffect, useCallback } from "react";

interface IngestionRun {
  _id: string;
  startedAt: string;
  completedAt: string;
  source: string;
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

interface StatusData {
  lastRun: IngestionRun | null;
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  totalFailed: number;
  recentRuns: IngestionRun[];
}

const SOURCES = [
  "Devfolio Hackathons",
  "Devpost Hackathons",
  "GitHub Open Source Programs",
  "Well-Known Student Programs",
];

export default function IngestionDashboard() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null); // null or source name
  const [runResult, setRunResult] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ingestion/status", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      console.error("Failed to fetch ingestion status");
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function runIngestion(sourceName?: string) {
    setRunning(sourceName || "all");
    setRunResult(null);

    try {
      const url = sourceName
        ? `/api/cron/ingest?source=${encodeURIComponent(sourceName)}`
        : "/api/cron/ingest";

      const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
      const data = await res.json();

      if (res.ok) {
        const d = data.data;
        setRunResult(
          `✓ Done! Fetched: ${d.totalFetched}, Inserted: ${d.totalInserted}, Skipped: ${d.totalSkipped}, Failed: ${d.totalFailed} (${d.durationMs}ms)`
        );
        fetchStatus(); // Refresh dashboard
      } else {
        setRunResult(`✗ Error: ${data.error || "Unknown error"}`);
      }
    } catch {
      setRunResult("✗ Network error");
    } finally {
      setRunning(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingestion Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and control the opportunity ingestion pipeline.
          </p>
        </div>
        <button
          onClick={() => runIngestion()}
          disabled={running !== null}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {running === "all" ? "Running All Sources..." : "Run All Sources"}
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Secret</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Paste ADMIN_SECRET to view or run ingestion"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Result Banner */}
      {runResult && (
        <div
          className={`text-sm rounded-lg p-3 border ${
            runResult.startsWith("✓")
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {runResult}
        </div>
      )}

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Fetched", value: status?.totalFetched ?? 0, color: "text-blue-600" },
          { label: "Total Inserted", value: status?.totalInserted ?? 0, color: "text-green-600" },
          { label: "Total Skipped", value: status?.totalSkipped ?? 0, color: "text-yellow-600" },
          { label: "Total Failed", value: status?.totalFailed ?? 0, color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Per-Source Controls */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOURCES.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4"
            >
              <div>
                <p className="font-medium text-sm text-gray-900">{name}</p>
                <p className="text-xs text-gray-400">
                  {status?.recentRuns.find((r) => r.source === name)
                    ? `Last: ${new Date(
                        status.recentRuns.find((r) => r.source === name)!.completedAt
                      ).toLocaleString()}`
                    : "Never run"}
                </p>
              </div>
              <button
                onClick={() => runIngestion(name)}
                disabled={running !== null}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
              >
                {running === name ? "Running..." : "Run"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Runs Log */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Runs</h2>
        {status?.recentRuns.length === 0 ? (
          <p className="text-sm text-gray-500">No ingestion runs yet. Click "Run All Sources" to start.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Source</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Fetched</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Inserted</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Skipped</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Failed</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Duration</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">When</th>
                </tr>
              </thead>
              <tbody>
                {status?.recentRuns.map((run) => (
                  <tr key={run._id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{run.source}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600">{run.fetched}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{run.inserted}</td>
                    <td className="px-4 py-2.5 text-right text-yellow-600">{run.skipped}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{run.failed}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">
                      {run.durationMs < 1000
                        ? `${run.durationMs}ms`
                        : `${(run.durationMs / 1000).toFixed(1)}s`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                      {new Date(run.completedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error Details */}
      {status?.recentRuns.some((r) => r.errors.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Errors</h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            {status.recentRuns
              .filter((r) => r.errors.length > 0)
              .slice(0, 5)
              .map((run) =>
                run.errors.map((err, i) => (
                  <div key={`${run._id}-${i}`} className="text-xs text-red-700 font-mono">
                    [{run.source}] {err}
                  </div>
                ))
              )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="text-sm text-gray-400 border-t border-gray-100 pt-4">
        <a href="/admin" className="text-blue-600 hover:underline">← Back to Admin</a>
      </div>
    </div>
  );
}
