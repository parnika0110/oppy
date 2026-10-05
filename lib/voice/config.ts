/**
 * Gnani AI configuration for OPPY's voice interface.
 *
 * Everything is read from the environment — no secret is ever hardcoded and
 * nothing here is ever exposed to the browser (this module is only imported
 * from API routes and server libraries).
 *
 *   GNANI_API_KEY             — Gnani platform credential (sent as X-API-Key-ID)
 *   GNANI_API_BASE_URL        — default https://api.vachana.ai
 *   GNANI_PRISMA_STT_PATH     — default /stt/v3
 *   GNANI_PRISMA_FORMAT       — default "transcribe" (inverse text normalisation)
 *   GNANI_PRISMA_DEFAULT_LANG — default en-IN
 *   GNANI_TIMBRE_TTS_PATH     — default /api/v1/tts/inference
 *   GNANI_TIMBRE_MODEL        — default timbre-v2.5
 *   GNANI_TIMBRE_VOICE        — default Nalini
 *   GNANI_TIMEOUT_MS          — default 25000
 *   GNANI_MOCK                — "true" → deterministic fixtures, zero API calls
 *
 * GNANI_MOCK is the development/test safety switch: it guarantees that local
 * development, automated tests and browser verification never consume Gnani
 * credits. Production sets GNANI_MOCK=false (or leaves it unset).
 */

import type { VoiceEngineStatus, VoiceLanguageCode } from "@/types/voice";

export interface GnaniConfig {
  apiKey: string;
  baseUrl: string;
  stt: {
    path: string;
    format: string;
    defaultLanguage: VoiceLanguageCode;
  };
  tts: {
    path: string;
    model: string;
    voice: string;
  };
  timeoutMs: number;
  /** Force demo/fixtures even when a credential exists. */
  mock: boolean;
}

function readBool(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Read the Gnani configuration from the environment (fresh on every call). */
export function getGnaniConfig(): GnaniConfig {
  return {
    apiKey: (process.env.GNANI_API_KEY ?? "").trim(),
    baseUrl: trimSlash(process.env.GNANI_API_BASE_URL?.trim() || "https://api.vachana.ai"),
    stt: {
      path: process.env.GNANI_PRISMA_STT_PATH?.trim() || "/stt/v3",
      format: process.env.GNANI_PRISMA_FORMAT?.trim() || "transcribe",
      defaultLanguage: (process.env.GNANI_PRISMA_DEFAULT_LANGUAGE?.trim() ||
        "en-IN") as VoiceLanguageCode,
    },
    tts: {
      path: process.env.GNANI_TIMBRE_TTS_PATH?.trim() || "/api/v1/tts/inference",
      model: process.env.GNANI_TIMBRE_MODEL?.trim() || "timbre-v2.5",
      voice: process.env.GNANI_TIMBRE_VOICE?.trim() || "Nalini",
    },
    timeoutMs: readNumber(process.env.GNANI_TIMEOUT_MS, 25000),
    mock: readBool(process.env.GNANI_MOCK),
  };
}

/** Mock mode is on — tests and local development never touch the Gnani API. */
export function isGnaniMock(): boolean {
  return getGnaniConfig().mock;
}

/** Live Gnani credentials present and mock mode not forced. */
export function isGnaniConfigured(): boolean {
  const config = getGnaniConfig();
  return config.apiKey.length > 0 && !config.mock;
}

/** Engine status for the UI (config only — performs no API call). */
export function getGnaniEngineStatus(): VoiceEngineStatus {
  const config = getGnaniConfig();
  const live = config.apiKey.length > 0 && !config.mock;
  return {
    stt: live ? "prisma" : config.mock ? "demo" : "unavailable",
    tts: live ? "timbre" : "demo",
    ttsModel: config.tts.model,
    ttsVoice: config.tts.voice,
    ready: live,
  };
}
