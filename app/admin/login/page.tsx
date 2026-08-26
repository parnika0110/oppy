"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError("Invalid secret. Access denied.");
        setSecret("");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "380px" }}>
        {/* Logo / wordmark */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            OPPY Admin
          </p>
          <h1
            className="font-display font-semibold"
            style={{ fontSize: "1.75rem", color: "var(--ink)", letterSpacing: "-0.02em" }}
          >
            Access Dashboard
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--ink-soft)" }}>
            Enter your admin key to continue.
          </p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="surface"
          style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          <div>
            <label
              htmlFor="admin-secret"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                marginBottom: "0.5rem",
                color: "var(--ink-soft)",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Admin Key
            </label>
            <input
              id="admin-secret"
              type="password"
              autoComplete="current-password"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••••••"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                background: "var(--paper)",
                color: "var(--ink)",
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--lavender-deep)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "#FEE2E2",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                fontSize: "0.85rem",
                color: "#991B1B",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !secret.trim()}
            style={{
              width: "100%",
              padding: "0.875rem",
              background: loading ? "var(--ink-soft)" : "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.9rem",
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s ease, opacity 0.2s ease",
              opacity: !secret.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "Verifying…" : "Enter Dashboard →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          OPPY · Admin access only
        </p>
      </div>
    </div>
  );
}
