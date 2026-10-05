/**
 * Thin, shared HTTP wrapper for the Gnani AI platform.
 *
 * Ported from the standalone Gnani voice app and adapted to OPPY's
 * env-driven config (lib/voice/config.ts) so the integration can be
 * re-pointed (proxy, new version, self-hosted gateway) without touching
 * call sites.
 *
 * Server-only: the credential is attached here and must never reach the
 * browser — this module is imported exclusively from API routes.
 */

import { getGnaniConfig } from "@/lib/voice/config";

export class GnaniApiError extends Error {
  readonly status: number;
  readonly type: string;

  constructor(status: number, type: string, message: string) {
    super(message);
    this.name = "GnaniApiError";
    this.status = status;
    this.type = type;
  }
}

interface GnaniErrorPayload {
  success?: boolean;
  error?: { type?: string; message?: string };
  message?: string;
}

export function gnaniUrl(path: string): string {
  const config = getGnaniConfig();
  return `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Perform an authenticated request against the Gnani platform.
 * Throws GnaniApiError on missing credentials, network failure or a
 * non-2xx response (with the platform's error type/message when present).
 */
export async function gnaniRequest(path: string, init: RequestInit): Promise<Response> {
  const config = getGnaniConfig();
  if (!config.apiKey) {
    throw new GnaniApiError(401, "MISSING_CREDENTIALS", "GNANI_API_KEY is not configured.");
  }

  const headers = new Headers(init.headers);
  headers.set("X-API-Key-ID", config.apiKey);

  let response: Response;
  try {
    response = await fetch(gnaniUrl(path), {
      ...init,
      headers,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new GnaniApiError(0, "NETWORK_ERROR", `Could not reach the Gnani API: ${message}`);
  }

  if (!response.ok) {
    let type = "API_ERROR";
    let message = `Gnani API responded with ${response.status}.`;
    try {
      const payload = (await response.json()) as GnaniErrorPayload;
      if (payload.error?.type) type = payload.error.type;
      if (payload.error?.message) message = payload.error.message;
      else if (payload.message) message = payload.message;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new GnaniApiError(response.status, type, message);
  }

  return response;
}

/** Best-effort mapping of browser recording MIME types to file extensions. */
export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("flac")) return "flac";
  if (normalized.includes("aac")) return "aac";
  return "webm";
}
