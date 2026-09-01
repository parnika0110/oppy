"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import ThemedOppyOrb from "@/components/ThemedOppyOrb";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signup(email, password, name);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/onboarding");
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
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
            <ThemedOppyOrb mood="excited" size={40} />
          </div>
          <p className="eyebrow mb-2">Get started</p>
          <h1 className="font-display font-semibold" style={{ fontSize: "1.75rem", color: "var(--ink)" }}>
            Create your OPPY account
          </h1>
        </div>

        {/* ── Google Sign-Up (prominent, above the fold) ── */}
        <a
          href="/api/auth/google?next=/onboarding"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.6rem",
            width: "100%",
            padding: "0.875rem",
            border: "1px solid var(--line)",
            borderRadius: 10,
            background: "var(--card)",
            color: "var(--ink)",
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "0.88rem",
            fontWeight: 600,
            textDecoration: "none",
            transition: "border-color 0.2s, background-color 0.2s",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>

        {/* ── Divider ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span style={{ fontSize: "0.72rem", fontFamily: "'JetBrains Mono', monospace", color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase" }}>or continue with email</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        {/* ── Email/Password Form ── */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}
        >
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </div>
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
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 4 }}>At least 8 characters.</p>
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
            {loading ? "Creating account…" : "Sign up →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          Already have an account? <a href="/login" className="underline-hover" style={{ color: "var(--accent-deep)" }}>Log in</a>
        </p>
      </div>
    </div>
  );
}
