import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSession, SESSION_COOKIE } from "@/lib/userAuth";
import { getUsersCollection, ensureUserIndexes } from "@/lib/mongodb";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Handles the OAuth callback from Google:
 * 1. Verify state matches the httpOnly cookie (CSRF + browser binding)
 * 2. Verify HMAC signature (integrity + open redirect prevention)
 * 3. Exchange authorization code for tokens
 * 4. Verify the ID token and extract user info
 * 5. Find existing user by email, or create new (upsert for race safety)
 * 6. Create OPPY session
 * 7. Redirect to dashboard/onboarding
 */

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const OAUTH_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_SECRET || "";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

const OAUTH_STATE_COOKIE = "oppy_oauth_state";

function getOAuthConfig() {
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
  };
}

/**
 * Verify HMAC-signed state and extract the redirect target.
 * Returns the safe redirect path, or null if invalid.
 */
function verifyState(signedState: string | null): string | null {
  if (!signedState || !OAUTH_SECRET) return null;

  const dotIdx = signedState.lastIndexOf(".");
  if (dotIdx < 0) return null;

  const payloadB64 = signedState.substring(0, dotIdx);
  const providedHmac = signedState.substring(dotIdx + 1);

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const colonIdx = payload.indexOf(":");
  if (colonIdx < 0) return null;

  const _nonce = payload.substring(0, colonIdx);
  const redirectPath = payload.substring(colonIdx + 1);

  // Verify HMAC
  const expectedHmac = crypto
    .createHmac("sha256", OAUTH_SECRET)
    .update(`${_nonce}:${redirectPath}`)
    .digest("hex");

  // Timing-safe comparison
  if (expectedHmac.length !== providedHmac.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expectedHmac.length; i++) {
    mismatch |= expectedHmac.charCodeAt(i) ^ providedHmac.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  // Validate redirect is safe (same-origin)
  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//") || /^https?:\/\//i.test(redirectPath)) {
    return null;
  }

  return redirectPath;
}

/** Clear the OAuth state cookie. */
function clearStateCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // delete immediately
  });
}

/** Exchange authorization code for tokens. */
async function exchangeCode(code: string, config: ReturnType<typeof getOAuthConfig>): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[Google OAuth] Token exchange failed:", res.status);
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  return res.json();
}

/** Verify the ID token by fetching Google's userinfo endpoint. */
async function verifyAndGetUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Userinfo fetch failed: ${res.status}`);
  }

  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const returnedState = searchParams.get("state");

  // Read the state cookie that was set during OAuth initiation
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value || null;

  // ── CSRF / browser binding check ────────────────────────────────────
  // The returned state must match the cookie value exactly.
  // This ensures the callback is consumed by the same browser that initiated the flow.
  if (!returnedState || !cookieState || returnedState !== cookieState) {
    console.error("[Google OAuth] State mismatch — possible CSRF attempt. returnedState exists:", !!returnedState, "cookieState exists:", !!cookieState);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Session expired or invalid. Please try again.");
    const response = NextResponse.redirect(loginUrl);
    clearStateCookie(response);
    return response;
  }

  // Now verify the HMAC signature on the state (integrity + open redirect check)
  const redirectTo = verifyState(returnedState) || "/dashboard";

  // Clear the state cookie — it's single-use
  // We'll do this on every exit path, but start clearing here
  const clearCookieHeaders: Record<string, string> = {};

  // Handle OAuth errors (user cancelled, denied access, etc.)
  if (error) {
    console.error("[Google OAuth] User denied or error:", error);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Google sign-in was cancelled.");
    const response = NextResponse.redirect(loginUrl);
    clearStateCookie(response);
    return response;
  }

  if (!code) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Missing authorization code.");
    const response = NextResponse.redirect(loginUrl);
    clearStateCookie(response);
    return response;
  }

  // Check OAuth configuration
  const config = getOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    console.error("[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Google sign-in is not configured.");
    const response = NextResponse.redirect(loginUrl);
    clearStateCookie(response);
    return response;
  }

  // Rate limit: max 20 OAuth callbacks per 15 minutes per IP
  const rlKey = getRateLimitKey(request, "google-oauth");
  const rl = checkRateLimit(rlKey, 20, 15 * 60 * 1000);
  if (!rl.allowed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Too many attempts. Please try again later.");
    const response = NextResponse.redirect(loginUrl);
    clearStateCookie(response);
    return response;
  }

  try {
    // Step 1: Exchange code for tokens
    const tokenRes = await exchangeCode(code, config);

    if (!tokenRes.access_token) {
      throw new Error("No access_token in token response");
    }

    // Step 2: Get user info from Google
    const googleUser = await verifyAndGetUserInfo(tokenRes.access_token);

    if (!googleUser.email || !googleUser.email_verified) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "Google account email is not verified.");
      const response = NextResponse.redirect(loginUrl);
      clearStateCookie(response);
      return response;
    }

    // Step 3: Find existing user or create new one (race-safe upsert)
    await ensureUserIndexes();
    const users = await getUsersCollection();
    const email = googleUser.email.trim().toLowerCase();

    // Try to find existing user first
    let user = await users.findOne({ email });
    let isNewUser = false;

    if (!user) {
      // New user — use insertOne (unique email index prevents duplicates)
      isNewUser = true;
      const now = new Date();
      try {
        const result = await users.insertOne({
          email,
          name: googleUser.name || googleUser.given_name || email.split("@")[0],
          // No passwordHash — Google-only user
          onboardingComplete: false,
          preferences: {},
          avatar: "lavender",
          createdAt: now,
          updatedAt: now,
        });
        user = await users.findOne({ _id: result.insertedId });
      } catch (err: any) {
        // Duplicate key error = another request created this user first
        if (err?.code === 11000) {
          user = await users.findOne({ email });
          isNewUser = false;
        } else {
          throw err;
        }
      }
    }

    if (!user) {
      throw new Error("Failed to create or find user after Google OAuth");
    }

    // Step 4: Create session
    const token = await createSession(user._id);

    // Step 5: Set session cookie and redirect
    const destination = isNewUser ? "/onboarding" : redirectTo;

    const response = NextResponse.redirect(new URL(destination, request.url));

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Clear the OAuth state cookie — flow is complete
    clearStateCookie(response);

    return response;
  } catch (err) {
    console.error("[Google OAuth] Callback error:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Google sign-in failed. Please try again.");
    const response = NextResponse.redirect(loginUrl);
    clearStateCookie(response);
    return response;
  }
}
