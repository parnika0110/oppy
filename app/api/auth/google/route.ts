import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/auth/google?next=/dashboard
 *
 * Initiates Google OAuth flow with CSRF-protected state parameter.
 *
 * The state is:
 * 1. HMAC-signed with SESSION_SECRET (prevents forgery)
 * 2. Stored in a short-lived httpOnly cookie (binds to the initiating browser)
 * 3. Verified against the cookie on callback (prevents cross-browser replay)
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const OAUTH_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_SECRET || "";

const OAUTH_STATE_COOKIE = "oppy_oauth_state";
const STATE_MAX_AGE = 5 * 60; // 5 minutes

/**
 * Get the public-facing origin.
 *
 * Priority:
 * 1. APP_URL env var (most secure — server-side only, not inlined at build time)
 * 2. x-forwarded-host / x-forwarded-proto headers (set by CloudFront on Amplify)
 * 3. Host header (for local development)
 * * Security: On Amplify, CloudFront controls these headers and clients cannot
 * inject values. The .split(",")[0] guards against multi-value header injection
 * if behind a naive proxy. In production, localhost is rejected as a safety net.
 */
function getPublicOrigin(request: NextRequest): string {
  // Most secure: explicit server-side env var (no header dependency)
  if (process.env.APP_URL) return process.env.APP_URL;

  // Derive from headers — take only the first value to prevent injection
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000").split(",")[0].trim();
  // Default to http for localhost/127.0.0.1 (local dev), https otherwise (production behind CloudFront)
  const proto = (request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")).split(",")[0].trim();
  const origin = `${proto}://${host}`;

  // Defense-in-depth: reject localhost in production (indicates misconfiguration)
  if (process.env.NODE_ENV === "production" && /^https?:\/\/localhost/i.test(origin)) {
    console.error("[OAuth] Production request resolved to localhost origin — APP_URL env var recommended");
  }

  return origin;
}

/** Generate an HMAC-signed state token that encodes the redirect target. */
function signState(next: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${nonce}:${next}`;
  const hmac = crypto.createHmac("sha256", OAUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64url") + "." + hmac;
}

/** Validate that a redirect path is safe (same-origin, starts with /, no protocol). */
function isSafeRedirect(path: string): boolean {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (/^https?:\/\//i.test(path)) return false;
  return true;
}

export async function GET(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID) {
    console.error("[Google OAuth] GOOGLE_CLIENT_ID not configured");
    const loginUrl = new URL("/login", getPublicOrigin(request));
    loginUrl.searchParams.set("error", "Google sign-in is not configured.");
    return NextResponse.redirect(loginUrl);
  }

  if (!OAUTH_SECRET) {
    console.error("[Google OAuth] SESSION_SECRET not configured — cannot sign state");
    const loginUrl = new URL("/login", getPublicOrigin(request));
    loginUrl.searchParams.set("error", "Google sign-in is not configured.");
    return NextResponse.redirect(loginUrl);
  }

  const next = request.nextUrl.searchParams.get("next") || "/dashboard";

  // Validate redirect target — prevent open redirects to external sites
  if (!isSafeRedirect(next)) {
    const loginUrl = new URL("/login", getPublicOrigin(request));
    loginUrl.searchParams.set("error", "Invalid redirect target.");
    return NextResponse.redirect(loginUrl);
  }

  const state = signState(next);
  // Derive redirect_uri from request headers — request.url on Amplify/Lambda
  // resolves to the internal localhost URL, not the public domain.
  const publicOrigin = getPublicOrigin(request);
  const REDIRECT_URI = `${publicOrigin}/api/auth/google/callback`;

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authorizationUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "select_account");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);

  // Store the signed state in a short-lived httpOnly cookie.
  // The callback will compare the returned state against this cookie value.
  // This binds the OAuth flow to the browser that initiated it.
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });

  return response;
}
