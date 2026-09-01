"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import OppyOrb from "@/components/OppyOrb";

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
        // AuthContext has set user state — safe to navigate
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
            <OppyOrb mood="excited" size={40} />
          </div>
          <p className="eyebrow mb-2">Get started</p>
          <h1 className="font-display font-semibold" style={{ fontSize: "1.75rem", color: "var(--ink)" }}>
            Create your OPPY account
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.1rem", border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}
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
          Already have an account? <a href="/login" className="underline-hover" style={{ color: "var(--lavender-deep)" }}>Log in</a>
        </p>
      </div>
    </div>
  );
}
