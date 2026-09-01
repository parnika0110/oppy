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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Google sign-in is not configured.");
    return NextResponse.redirect(loginUrl);
  }

  if (!OAUTH_SECRET) {
    console.error("[Google OAuth] SESSION_SECRET not configured — cannot sign state");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Google sign-in is not configured.");
    return NextResponse.redirect(loginUrl);
  }

  const next = request.nextUrl.searchParams.get("next") || "/dashboard";

  // Validate redirect target — prevent open redirects to external sites
  if (!isSafeRedirect(next)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Invalid redirect target.");
    return NextResponse.redirect(loginUrl);
  }

  const state = signState(next);
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

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
