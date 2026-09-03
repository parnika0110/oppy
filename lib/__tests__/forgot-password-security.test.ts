import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const routeCode = readFileSync("app/api/auth/forgot-password/route.ts", "utf8");
const resetRouteCode = readFileSync("app/api/auth/reset-password/route.ts", "utf8");
const authCode = readFileSync("lib/userAuth.ts", "utf8");
const emailCode = readFileSync("lib/email.ts", "utf8");
const pageCode = readFileSync("app/forgot-password/page.tsx", "utf8");

// ── generateResetCode user existence check ────────────────────────────────

describe("generateResetCode — user existence check", () => {
  it("returns null when user not found", () => {
    expect(authCode).toContain("if (!user) return null");
  });

  it("checks user existence before creating reset record", () => {
    const userCheckIdx = authCode.indexOf("const user = await users.findOne");
    const insertIdx = authCode.indexOf("await resets.insertOne");
    expect(userCheckIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(userCheckIdx);
  });

  it("invalidates previous unused codes before creating new one", () => {
    expect(authCode).toContain("updateMany");
    expect(authCode).toContain("used: false");
  });

  it("generates a 6-digit cryptographically secure code", () => {
    expect(authCode).toContain("crypto.randomInt(100000, 1000000)");
  });

  it("sets expiry on reset codes", () => {
    expect(authCode).toContain("expiresAt");
  });

  it("verifyResetCode checks expiry and used status", () => {
    expect(authCode).toContain("expiresAt: { $gt: new Date() }");
    expect(authCode).toContain("used: false");
  });

  it("resetPasswordWithCode marks code as used after success", () => {
    // CRLF line endings consume character budget, so use a large range
    const fnIdx = authCode.indexOf("export async function resetPasswordWithCode");
    const fn = authCode.substring(fnIdx, fnIdx + 1500);
    expect(fn).toContain("used: true");
  });
});

// ── forgot-password API route — enumeration prevention ────────────────────

describe("forgot-password API — email enumeration prevention", () => {
  it("returns identical generic response for all cases", () => {
    expect(routeCode).toContain("If an account exists with that email, a reset code has been sent.");
  });

  it("does not return 404 for non-existent users", () => {
    expect(routeCode).not.toContain("status: 404");
  });

  it("does not reveal email-sent status in response body", () => {
    expect(routeCode).not.toContain("email_sent");
    expect(routeCode).not.toContain('"sent"');
  });

  it("skips email when code is null (user not found)", () => {
    // Route uses either `if (code)` or `if (result)` — both check whether code was generated
    const hasCodeCheck = routeCode.includes("if (code)") || routeCode.includes("if (result)");
    expect(hasCodeCheck).toBe(true);
    expect(routeCode).toContain("sendPasswordResetEmail");
  });

  it("validates email input", () => {
    expect(routeCode).toContain("if (!email");
  });

  it("applies rate limiting", () => {
    expect(routeCode).toContain("checkRateLimit");
  });
});

// ── reset-password API route — code validation ───────────────────────────

describe("reset-password API — code validation", () => {
  it("validates 6-digit code format", () => {
    expect(resetRouteCode).toContain("/^\\d{6}$/");
  });

  it("validates password minimum length", () => {
    expect(resetRouteCode).toContain("password.length < 8");
  });

  it("applies rate limiting", () => {
    expect(resetRouteCode).toContain("checkRateLimit");
  });

  it("returns generic error for invalid codes (no enumeration)", () => {
    expect(resetRouteCode).toContain("Invalid or expired reset code");
  });
});

// ── no email addresses in logs ───────────────────────────────────────────

describe("forgot-password — no email addresses in logs", () => {
  it("forgot-password route does not interpolate email in logs", () => {
    const logLines = routeCode.split("\n").filter(
      (l) => l.includes("console.log") || l.includes("console.error")
    );
    for (const line of logLines) {
      expect(line).not.toMatch(/\$\{.*email/);
      expect(line).not.toContain("email.trim()");
    }
  });

  it("email.ts does not log email addresses", () => {
    const fnStart = emailCode.indexOf("export async function sendPasswordResetEmail");
    const fnEnd = emailCode.indexOf("export async function sendDeadlineReminder");
    const fn = emailCode.substring(fnStart, fnEnd);
    const logLines = fn.split("\n").filter(
      (l) => l.includes("console.log") || l.includes("console.error")
    );
    for (const line of logLines) {
      expect(line).not.toMatch(/\$\{.*email/);
    }
  });
});

// ── resend flow ──────────────────────────────────────────────────────────

describe("forgot-password — resend flow", () => {
  it("resend uses the same endpoint as initial request", () => {
    const fetchCalls = pageCode.match(/fetch\(.*forgot-password/g);
    expect(fetchCalls).not.toBeNull();
    expect(fetchCalls!.length).toBeGreaterThanOrEqual(2);
  });

  it("resend goes through same generateResetCode user check", () => {
    expect(routeCode).toContain("generateResetCode");
  });
});
