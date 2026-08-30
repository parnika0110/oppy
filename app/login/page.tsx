"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(next);
        router.refresh();
      } else {
        setError(data.error || "Login failed.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <p className="eyebrow mb-2">Welcome back</p>
          <h1 className="font-display font-semibold" style={{ fontSize: "1.75rem", color: "var(--ink)" }}>
            Log in to OPPY
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="surface"
          style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.1rem", border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}
        >
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="eyebrow">Password</label>
              <a
                href="/forgot-password"
                className="underline-hover"
                style={{ fontSize: "0.75rem", color: "var(--lavender-deep)" }}
              >
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </div>

          {error && (
            <div style={{ padding: "0.75rem 1rem", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, fontSize: "0.85rem", color: "#991B1B" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{
              padding: "0.875rem",
              background: loading ? "var(--ink-soft)" : "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 10,
              fontSize: "0.9rem",
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Logging in…" : "Log in →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          No account? <a href="/signup" className="underline-hover" style={{ color: "var(--lavender-deep)" }}>Sign up</a>
        </p>
      </div>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 120, height: 14, borderRadius: 4, background: "var(--line)", margin: "0 auto 0.75rem" }} />
          <div style={{ width: 220, height: 28, borderRadius: 6, background: "var(--line)", margin: "0 auto" }} />
        </div>
        <div
          className="surface"
          style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.1rem", border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}
        >
          <div>
            <div style={{ width: 48, height: 12, borderRadius: 4, background: "var(--line)", marginBottom: 6 }} />
            <div style={{ width: "100%", height: 42, borderRadius: 12, background: "var(--paper)", border: "1px solid var(--line)" }} />
          </div>
          <div>
            <div style={{ width: 64, height: 12, borderRadius: 4, background: "var(--line)", marginBottom: 6 }} />
            <div style={{ width: "100%", height: 42, borderRadius: 12, background: "var(--paper)", border: "1px solid var(--line)" }} />
          </div>
          <div style={{ width: "100%", height: 46, borderRadius: 10, background: "var(--ink-soft)" }} />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
