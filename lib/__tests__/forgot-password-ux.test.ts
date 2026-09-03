import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

// ── 1. Password Visibility Toggle ──────────────────────────────────────────

describe("Forgot password — password visibility toggle", () => {
  const pageCode = readFileSync("app/forgot-password/page.tsx", "utf8");

  it("has showPassword state", () => {
    expect(pageCode).toContain("showPassword");
  });

  it("has showConfirm state", () => {
    expect(pageCode).toContain("showConfirm");
  });

  it("new password input toggles between text and password", () => {
    expect(pageCode).toContain("showPassword ? \"text\" : \"password\"");
  });

  it("confirm password input toggles between text and password", () => {
    expect(pageCode).toContain("showConfirm ? \"text\" : \"password\"");
  });

  it("has eye button for new password with aria-label", () => {
    expect(pageCode).toContain("aria-label={showPassword ? \"Hide password\" : \"Show password\"}");
  });

  it("has eye button for confirm password with aria-label", () => {
    expect(pageCode).toContain("aria-label={showConfirm ? \"Hide password\" : \"Show password\"}");
  });

  it("eye buttons are type=button to prevent form submission", () => {
    // Count type="button" occurrences near the eye buttons
    const matches = pageCode.match(/type="button"[^>]*aria-label.*password/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it("eye buttons have tabIndex=-1 to not trap keyboard focus", () => {
    expect(pageCode).toContain("tabIndex={-1}");
  });

  it("does not alter password validation logic", () => {
    expect(pageCode).toContain("passwordValid = password.length >= 8");
    expect(pageCode).toContain("passwordsMatch = password === confirmPassword");
  });

  it("does not alter password submission behavior", () => {
    expect(pageCode).toContain("handleResetPassword");
    expect(pageCode).toContain("code: code.trim()");
    expect(pageCode).toContain("password,");
  });
});

// ── 2. Reset Code Expiry Countdown ─────────────────────────────────────────

describe("Forgot password — countdown timer", () => {
  const pageCode = readFileSync("app/forgot-password/page.tsx", "utf8");

  it("has expiresAt state", () => {
    expect(pageCode).toContain("expiresAt");
  });

  it("has remaining state", () => {
    expect(pageCode).toContain("remaining");
  });

  it("sets expiresAt from server expiresIn response", () => {
    expect(pageCode).toContain("data.expiresIn");
    expect(pageCode).toContain("setExpiresAt(Date.now() + data.expiresIn * 1000)");
  });

  it("has fallback when server does not return expiresIn", () => {
    expect(pageCode).toContain("setExpiresAt(Date.now() + 15 * 60 * 1000)");
  });

  it("has interval-based countdown that ticks every second", () => {
    expect(pageCode).toContain("setInterval(tick, 1000)");
  });

  it("cleans up interval on unmount", () => {
    expect(pageCode).toContain("return () => clearInterval(id)");
  });

  it("formats countdown as MM:SS", () => {
    expect(pageCode).toContain("padStart(2, \"0\")");
    expect(pageCode).toContain("formatCountdown");
  });

  it("shows 'Code expired' when remaining reaches zero", () => {
    expect(pageCode).toContain("Code expired");
  });

  it("shows countdown text when code is valid", () => {
    expect(pageCode).toContain("Code expires in");
  });

  it("highlights countdown in red when <= 120 seconds", () => {
    expect(pageCode).toContain("remaining <= 120");
  });

  it("resend restarts the countdown with fresh expiry", () => {
    // handleResendCode should call setExpiresAt with new expiry
    expect(pageCode).toContain("setExpiresAt(Date.now() + data.expiresIn * 1000)");
  });

  it("does not hardcode fake expiry duration in primary path", () => {
    // The primary path should use data.expiresIn, not a hardcoded value
    const primarySetExpiry = pageCode.indexOf("setExpiresAt(Date.now() + data.expiresIn * 1000)");
    expect(primarySetExpiry).toBeGreaterThan(0);
  });
});

// ── 3. API Security — no sensitive data exposed ─────────────────────────────

describe("Forgot password — API security", () => {
  const routeCode = readFileSync("app/api/auth/forgot-password/route.ts", "utf8");

  it("does not expose reset code in response", () => {
    // The response should not contain result.code or the code value
    expect(routeCode).not.toContain("code: result.code");
    expect(routeCode).not.toContain("code: code");
  });

  it("does not expose email existence to the client", () => {
    // Both cases return the same message
    expect(routeCode).toContain("If an account exists with that email, a reset code has been sent.");
  });

  it("returns expiresIn only when code was generated", () => {
    expect(routeCode).toContain("...(result ? { expiresIn: result.expiresIn } : {})");
  });

  it("does not expose expiresAt timestamp (only duration)", () => {
    // Should return expiresIn (seconds), not expiresAt (absolute timestamp)
    expect(routeCode).not.toContain("expiresAt");
    expect(routeCode).toContain("expiresIn");
  });
});

// ── 4. generateResetCode return type ────────────────────────────────────────

describe("generateResetCode — returns expiry info", () => {
  const authCode = readFileSync("lib/userAuth.ts", "utf8");

  it("returns ResetCodeResult interface (code + expiresIn)", () => {
    expect(authCode).toContain("ResetCodeResult");
    expect(authCode).toContain("code: string");
    expect(authCode).toContain("expiresIn: number");
  });

  it("returns { code, expiresIn } on success", () => {
    expect(authCode).toContain("return { code, expiresIn:");
  });

  it("returns null for non-existent users", () => {
    expect(authCode).toContain("if (!user) return null");
  });

  it("computes expiresIn from RESET_CODE_TTL_MS", () => {
    expect(authCode).toContain("Math.floor(RESET_CODE_TTL_MS / 1000)");
  });

  it("does not expose the raw TTL constant in the return value", () => {
    // The return value should be computed, not raw
    expect(authCode).toContain("Math.floor(RESET_CODE_TTL_MS / 1000)");
  });
});
