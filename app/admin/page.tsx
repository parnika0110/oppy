"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, COMMON_LOCATIONS, COMMON_TAGS, Category } from "@/types/opportunity";

const emptyForm = {
  title: "",
  organization: "",
  category: "Internship" as Category,
  location: "Remote",
  tags: [] as string[],
  description: "",
  applicationLink: "",
  imageUrl: "",
  deadline: "",
  source: "",
};

// ── Stat pill component ────────────────────────────────────────────────────
function StatPill({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div
      className="surface-flat"
      style={{ padding: "1rem 1.25rem", minWidth: "100px", textAlign: "center" }}
    >
      <p
        className="font-display font-bold"
        style={{ fontSize: "1.75rem", color: accent || "var(--ink)", marginBottom: "0.25rem" }}
      >
        {value}
      </p>
      <p className="eyebrow" style={{ fontSize: "0.68rem" }}>
        {label}
      </p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);
  const [stats, setStats] = useState<{ active: number; closed: number; candidates: number; total: number } | null>(null);
  const [ingestionRunning, setIngestionRunning] = useState(false);
  const [ingestionLog, setIngestionLog] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "add">("overview");

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch("/api/admin/ingestion/status");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStats(data.summary || null);
      }
    } catch {
      // Stats optional
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  async function runIngestion() {
    setIngestionRunning(true);
    setIngestionLog("Starting ingestion pipeline…");
    try {
      // Trigger via dedicated run-now API that uses cookie auth
      const res = await fetch("/api/admin/run-ingestion", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const r = data.result;
        setIngestionLog(
          `✓ Pipeline complete in ${(r.durationMs / 1000).toFixed(1)}s\n` +
          `Fetched: ${r.totalFetched}  Inserted: ${r.totalInserted}  ` +
          `Skipped: ${r.totalSkipped}  Failed: ${r.totalFailed}\n` +
          (r.sourceResults || [])
            .map((s: any) => `  ${s.source}: fetched=${s.fetched} inserted=${s.inserted} skipped=${s.skipped}`)
            .join("\n")
        );
        loadStats();
      } else if (res.status === 401) {
        router.push("/admin/login");
      } else {
        setIngestionLog(`✗ ${data.error || "Pipeline failed."}`);
      }
    } catch (e) {
      setIngestionLog(`✗ Network error: ${String(e)}`);
    } finally {
      setIngestionRunning(false);
    }
  }

  function toggleTag(tag: string) {
    setForm((f) =>
      f.tags.includes(tag)
        ? { ...f, tags: f.tags.filter((t) => t !== tag) }
        : { ...f, tags: [...f.tags, tag] }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setMismatchWarning(null);

    try {
      const res = await fetch("/api/admin/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Cookie sent automatically — no Authorization header needed
        body: JSON.stringify({
          ...form,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Failed to create opportunity." });
        return;
      }
      if (data.flaggedCategoryMismatch && data.item.categoryValidation) {
        setMismatchWarning(
          `AI flagged a possible category mismatch: "${data.item.categoryValidation.reasoning}" ` +
            (data.item.categoryValidation.suggestedCategory
              ? `Suggested category: ${data.item.categoryValidation.suggestedCategory}.`
              : "")
        );
      }
      setResult({ type: "success", message: `✓ Created: "${data.item.title}"` });
      setForm(emptyForm);
      loadStats();
    } catch {
      setResult({ type: "error", message: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1.25rem",
    borderRadius: "999px",
    fontSize: "0.85rem",
    fontWeight: 600,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
    border: "none",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--paper)" : "var(--ink-soft)",
    transition: "all 0.2s ease",
  });

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>Admin</p>
          <h1 className="font-display font-semibold" style={{ fontSize: "1.75rem", color: "var(--ink)" }}>
            OPPY Dashboard
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a
            href="/admin/runs"
            style={{
              fontSize: "0.85rem",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              textDecoration: "none",
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
            }}
          >
            Runs →
          </a>
          <a
            href="/admin/sources"
            style={{
              fontSize: "0.85rem",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              textDecoration: "none",
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
            }}
          >
            Sources →
          </a>
          <button
            onClick={handleLogout}
            style={{
              fontSize: "0.85rem",
              color: "#991B1B",
              border: "1px solid #FECACA",
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              background: "#FEF2F2",
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <StatPill label="Active" value={stats.active} accent="var(--sage-deep)" />
          <StatPill label="Closed" value={stats.closed} />
          <StatPill label="Candidates" value={stats.candidates} accent="var(--lavender-deep)" />
          <StatPill label="Total" value={stats.total} />
        </div>
      )}

      {/* ── Discovery run ── */}
      <div className="surface-flat" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <p style={{ fontWeight: 600, color: "var(--ink)", fontFamily: "'Space Grotesk', sans-serif" }}>
              Discovery Pipeline
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "0.15rem" }}>
              {process.env.NEXT_PUBLIC_CRON_CONFIGURED === "true"
                ? "Automatic discovery is active."
                : "Manual runs only — set CRON_SECRET to enable scheduler."}
            </p>
          </div>
          <button
            onClick={runIngestion}
            disabled={ingestionRunning}
            style={{
              padding: "0.5rem 1.25rem",
              background: ingestionRunning ? "var(--ink-soft)" : "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: "999px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: ingestionRunning ? "not-allowed" : "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              transition: "background 0.2s ease",
            }}
          >
            {ingestionRunning ? "Running…" : "Run Now →"}
          </button>
        </div>
        {ingestionLog && (
          <pre
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.75rem",
              color: "var(--ink-soft)",
              background: "var(--paper-2)",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {ingestionLog}
          </pre>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button style={tabStyle(activeTab === "overview")} onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button style={tabStyle(activeTab === "add")} onClick={() => setActiveTab("add")}>
          Add Opportunity
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="surface-flat" style={{ padding: "1.5rem" }}>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
            Use the discovery pipeline above to fetch new opportunities. Candidates requiring review
            appear in the{" "}
            <a href="/admin/ingestion" style={{ color: "var(--lavender-deep)", textDecoration: "underline" }}>
              Ingestion Dashboard
            </a>
            .
          </p>
          <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--paper-2)", borderRadius: "10px" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Sources</p>
            {[
              { name: "Devfolio Hackathons", configured: true, note: "Public API" },
              { name: "Devpost Hackathons", configured: true, note: "Public feed" },
              { name: "Internshala", configured: true, note: "Public search" },
              { name: "Luma Events", configured: true, note: "Public discovery feed" },
              { name: "JSearch (LinkedIn/Indeed)", configured: Boolean(process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY), note: "Requires RAPIDAPI_KEY" },
            ].map((src) => (
              <div
                key={src.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: src.configured ? "var(--sage-deep)" : "#CBD5E1",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", flex: 1 }}>
                  {src.name}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {src.configured ? src.note : "Not configured"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "add" && (
        <form onSubmit={handleSubmit} className="surface" style={{ padding: "1.5rem 2rem" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "1.25rem" }}>
            AI will auto-generate the summary, eligibility, and tags.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Organization *</label>
                <input required value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Category *</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  style={{ ...inputStyle, background: "var(--paper)" }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Location *</label>
                <input required list="location-suggestions" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} style={inputStyle} />
                <datalist id="location-suggestions">
                  {COMMON_LOCATIONS.map((l) => <option key={l} value={l} />)}
                </datalist>
              </div>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Deadline</label>
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>

            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>
                Tags <span style={{ fontFamily: "inherit", textTransform: "none", letterSpacing: "normal", opacity: 0.6 }}>(AI will suggest if blank)</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {COMMON_TAGS.map((tag) => (
                  <button type="button" key={tag} onClick={() => toggleTag(tag)}
                    style={{
                      fontSize: "0.75rem", padding: "0.3rem 0.7rem", borderRadius: "999px",
                      border: "1px solid var(--line)",
                      background: form.tags.includes(tag) ? "var(--ink)" : "var(--paper)",
                      color: form.tags.includes(tag) ? "var(--paper)" : "var(--ink)",
                      cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                    }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Description *</label>
              <textarea required rows={6} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Paste the full raw description — AI reads this to generate the summary."
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Application Link *</label>
              <input required type="url" value={form.applicationLink}
                onChange={(e) => setForm({ ...form, applicationLink: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Image URL</label>
                <input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: "0.4rem" }}>Source</label>
                <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="e.g. Unstop, Devpost" style={inputStyle} />
              </div>
            </div>

            <button type="submit" disabled={submitting}
              style={{
                padding: "0.875rem", background: submitting ? "var(--ink-soft)" : "var(--ink)",
                color: "var(--paper)", border: "none", borderRadius: "10px",
                fontSize: "0.9rem", fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
                cursor: submitting ? "not-allowed" : "pointer",
              }}>
              {submitting ? "Processing with AI…" : "Create Opportunity"}
            </button>
          </div>

          {mismatchWarning && (
            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", fontSize: "0.85rem", color: "#92400E" }}>
              ⚠ {mismatchWarning}
            </div>
          )}
          {result && (
            <div style={{
              marginTop: "1rem", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.85rem",
              background: result.type === "success" ? "#F0FDF4" : "#FEF2F2",
              border: `1px solid ${result.type === "success" ? "#BBF7D0" : "#FECACA"}`,
              color: result.type === "success" ? "#166534" : "#991B1B",
            }}>
              {result.message}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.875rem",
  border: "1px solid var(--line)",
  borderRadius: "8px",
  background: "var(--paper)",
  color: "var(--ink)",
  fontSize: "0.9rem",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
