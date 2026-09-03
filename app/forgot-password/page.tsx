"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const loginUrl = `/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`;

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Expiry countdown state ──────────────────────────────────────
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Live countdown — ticks every second while on Step 2
  useEffect(() => {
    if (step !== "reset" || expiresAt === null) {
      setRemaining(null);
      return;
    }
    function tick() {
      const secs = Math.max(0, Math.ceil((expiresAt! - Date.now()) / 1000));
      setRemaining(secs);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, expiresAt]);

  // Format remaining seconds as MM:SS
  function formatCountdown(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const codeExpired = remaining !== null && remaining <= 0;

  // ── Resend code ────────────────────────────────────────────────
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleResendCode() {
    if (resendCooldown > 0 || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        // Restart countdown with fresh expiry
        if (data.expiresIn) {
          setExpiresAt(Date.now() + data.expiresIn * 1000);
        } else {
          // Fallback: 15 minutes from now (server didn't return expiresIn)
          setExpiresAt(Date.now() + 15 * 60 * 1000);
        }
        setResendCooldown(30);
        setError(null);
      } else {
        setError(data.error || "Failed to resend code.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Password validation
  const passwordsMatch = password === confirmPassword || confirmPassword === "";
  const passwordValid = password.length >= 8;
  const canSubmitReset = code.trim().length >= 4 && passwordValid && passwordsMatch && !loading;

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setStep("reset");
        setError(null);
        // Start countdown from server-provided expiry
        if (data.expiresIn) {
          setExpiresAt(Date.now() + data.expiresIn * 1000);
        } else {
          // Fallback: 15 minutes from now
          setExpiresAt(Date.now() + 15 * 60 * 1000);
        }
      } else {
        setError(data.error || "Failed to send reset code.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitReset) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          password,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message || "Password reset successful!");
        setError(null);
      } else {
        setError(data.error || "Reset failed.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Shared eye button styles ────────────────────────────────────
  const eyeBtnStyle: React.CSSProperties = {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
    color: "var(--ink-soft)",
    fontSize: "1rem",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const passwordInputWrapStyle: React.CSSProperties = {
    position: "relative",
  };

  // ── Success state ─────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
          <div style={{ marginBottom: "2rem" }}>
            <p className="eyebrow mb-2">Password reset</p>
            <h1
              className="font-display font-semibold"
              style={{ fontSize: "1.75rem", color: "var(--ink)" }}
            >
              All set!
            </h1>
          </div>
          <div
            style={{
              padding: "1.25rem 1rem",
              background: "#D1FAE5",
              border: "1px solid #A7F3D0",
              borderRadius: 12,
              fontSize: "0.9rem",
              color: "#065F46",
              marginBottom: "1.5rem",
            }}
          >
            {success}
          </div>
          <a
            href={loginUrl}
            style={{
              display: "inline-block",
              padding: "0.875rem 2rem",
              background: "var(--ink)",
              color: "var(--paper)",
              borderRadius: 10,
              fontSize: "0.9rem",
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              textDecoration: "none",
            }}
          >
            Log in →
          </a>
        </div>
      </div>
    );
  }

  // ── Step 1: Request code ──────────────────────────────────────
  if (step === "email") {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <p className="eyebrow mb-2">Reset password</p>
            <h1
              className="font-display font-semibold"
              style={{ fontSize: "1.75rem", color: "var(--ink)" }}
            >
              Forgot your password?
            </h1>
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
              Enter your email and we&apos;ll send you a reset code.
            </p>
          </div>

          <form
            onSubmit={handleRequestCode}
            style={{
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.1rem",
              border: "1px solid var(--line)",
              borderRadius: 16,
              background: "var(--card)",
            }}
          >
            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
                autoFocus
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#FEE2E2",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  color: "#991B1B",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full"
              style={{
                padding: "0.875rem",
                background: loading || !email.trim() ? "var(--ink-soft)" : "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 10,
                fontSize: "0.9rem",
                fontWeight: 600,
                fontFamily: "'Space Grotesk', sans-serif",
                cursor: loading || !email.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Sending…" : "Send reset code →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            Remember your password?{" "}
            <a
              href={loginUrl}
              className="underline-hover"
              style={{ color: "var(--lavender-deep)" }}
            >
              Log in
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Enter code + new password ─────────────────────────────
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <p className="eyebrow mb-2">Step 2 of 2</p>
          <h1
            className="font-display font-semibold"
            style={{ fontSize: "1.75rem", color: "var(--ink)" }}
          >
            Reset your password
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            Enter the code sent to <strong>{email}</strong> and choose a new password.
          </p>
        </div>

        <form
          onSubmit={handleResetPassword}
          style={{
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.1rem",
            border: "1px solid var(--line)",
            borderRadius: 16,
            background: "var(--card)",
          }}
        >
          {/* ── Reset code ──── */}
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Reset code
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your 6-digit code"
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.1em",
                textAlign: "center",
              }}
              autoFocus
              autoComplete="one-time-code"
            />
          </div>

          {/* ── Countdown timer ──── */}
          {remaining !== null && (
            <div style={{ textAlign: "center", fontSize: "0.8rem", color: codeExpired ? "#991B1B" : "var(--ink-soft)" }}>
              {codeExpired ? (
                <span style={{ fontWeight: 600 }}>Code expired</span>
              ) : (
                <span>Code expires in <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: remaining <= 120 ? "#991B1B" : "var(--ink)" }}>{formatCountdown(remaining)}</strong></span>
              )}
            </div>
          )}

          {/* ── New password ──── */}
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
              New password
            </label>
            <div style={passwordInputWrapStyle}>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{
                  border: `1px solid ${password && !passwordValid ? "#FECACA" : "var(--line)"}`,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  paddingRight: 40,
                }}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                style={eyeBtnStyle}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
            {password && !passwordValid && (
              <p style={{ marginTop: 4, fontSize: "0.75rem", color: "#991B1B" }}>
                Password must be at least 8 characters.
              </p>
            )}
          </div>

          {/* ── Confirm password ──── */}
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Confirm password
            </label>
            <div style={passwordInputWrapStyle}>
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{
                  border: `1px solid ${confirmPassword && !passwordsMatch ? "#FECACA" : "var(--line)"}`,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  paddingRight: 40,
                }}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                onClick={() => setShowConfirm(!showConfirm)}
                style={eyeBtnStyle}
                tabIndex={-1}
              >
                {showConfirm ? "🙈" : "👁"}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p style={{ marginTop: 4, fontSize: "0.75rem", color: "#991B1B" }}>
                Passwords do not match.
              </p>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "#FEE2E2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                fontSize: "0.85rem",
                color: "#991B1B",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmitReset}
            className="w-full"
            style={{
              padding: "0.875rem",
              background: !canSubmitReset ? "var(--ink-soft)" : "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 10,
              fontSize: "0.9rem",
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: !canSubmitReset ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Resetting…" : "Reset password →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || loading}
              style={{
                background: "none",
                border: "none",
                color: resendCooldown > 0 ? "var(--ink-soft)" : "var(--lavender-deep)",
                cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn't receive the code? Resend"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setError(null); setExpiresAt(null); setRemaining(null); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--lavender-deep)",
                cursor: "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
            >
              ← Use a different email
            </button>
          </div>
        </p>
      </div>
    </div>
  );
}

function ForgotPasswordSkeleton() {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 120, height: 14, borderRadius: 4, background: "var(--line)", margin: "0 auto 0.75rem" }} />
          <div style={{ width: 260, height: 28, borderRadius: 6, background: "var(--line)", margin: "0 auto" }} />
        </div>
        <div
          style={{
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.1rem",
            border: "1px solid var(--line)",
            borderRadius: 16,
            background: "var(--card)",
          }}
        >
          <div>
            <div style={{ width: 48, height: 12, borderRadius: 4, background: "var(--line)", marginBottom: 6 }} />
            <div style={{ width: "100%", height: 42, borderRadius: 12, background: "var(--paper)", border: "1px solid var(--line)" }} />
          </div>
          <div style={{ width: "100%", height: 46, borderRadius: 10, background: "var(--ink-soft)" }} />
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordSkeleton />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
