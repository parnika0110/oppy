import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Admin session tokens.
 *
 * The browser session cookie is NEVER the ADMIN_SECRET itself — that would
 * mean anyone who reads the cookie (XSS, log leak, shared machine) gets the
 * literal server credential, which also authenticates as a Bearer token on
 * every API. Instead we issue a random, time-limited, HMAC-signed session
 * token. ADMIN_SECRET is used only as the server-side signing key; it never
 * leaves the server.
 *
 * Cookie value shape: "<random>.<expiresAtMs>.<signature>"
 * signature = HMAC-SHA256(ADMIN_SECRET, "<random>.<expiresAtMs>")
 *
 * This is intentionally stateless (no session store / DB round-trip needed
 * to validate), while still being impossible to forge without ADMIN_SECRET
 * and impossible to replay past its expiry.
 */

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Mint a new signed admin session token. Requires ADMIN_SECRET to be configured. */
export function createAdminSessionToken(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not configured");

  const random = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${random}.${expiresAt}`;
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

/** Verify a session token's signature and expiry without needing storage. */
export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [random, expiresAtStr, signature] = parts;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSignature = sign(`${random}.${expiresAtStr}`, secret);
  return timingSafeEqual(signature, expectedSignature);
}

function matchesBearerToken(request: Request, secret?: string): boolean {
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function isAdminRequest(request: NextRequest | Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  // Bearer ADMIN_SECRET — reserved for server-to-server / programmatic access
  // (cron jobs, scripts). The browser dashboard never sends this header.
  if (matchesBearerToken(request, secret)) {
    return true;
  }

  // Browser session — signed random token, never the raw secret.
  const cookieStore = await cookies();
  const token = cookieStore.get("oppy_admin_session");
  if (verifyAdminSessionToken(token?.value)) {
    return true;
  }

  return false;
}

export async function isCronRequest(request: NextRequest | Request): Promise<boolean> {
  return matchesBearerToken(request, process.env.CRON_SECRET) || await isAdminRequest(request);
}
