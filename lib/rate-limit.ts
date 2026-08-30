/**
 * Simple in-memory rate limiter for API endpoints.
 *
 * Uses a sliding window counter per key (typically IP address).
 * Resets on server restart — acceptable for auth endpoints where
 * a brief window of unrestricted access is not a security risk.
 *
 * For distributed/production-grade rate limiting, use Redis or a
 * middleware service (e.g. Upstash Rate Limit, Vercel's built-in).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks from stale entries
const CLEANUP_INTERVAL_MS = 60_000; // every 60 seconds
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

/**
 * Check and increment rate limit for a given key.
 *
 * @param key - Unique identifier (e.g. IP address or IP + endpoint)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, remaining: number, retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    // Rate limited
    const retryAfterMs = entry.resetAt - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  // Increment
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}

/**
 * Extract a rate-limit key from a request.
 * Uses x-forwarded-for header (for Amplify/cloud deployments behind a proxy)
 * with fallback to a generic key.
 */
export function getRateLimitKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${suffix}`;
}
