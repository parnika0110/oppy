/**
 * Shared type contracts for the Gnani-powered voice interface.
 *
 * Pipeline:
 *   microphone → POST /api/stt (Gnani Prisma) → transcript
 *   → preference extraction → OPPY discovery/ranking (MongoDB + relevance engine)
 *   → POST /api/tts (Gnani Timbre) → spoken response
 *
 * Keep this file dependency-free so both server routes and client
 * components can import it without pulling server-only modules.
 */

import type { OpportunityDocument } from "@/types/opportunity";

/** Languages exposed by the voice UI. Codes map to Gnani Prisma `language_code`. */
export type VoiceLanguageCode =
  | "en-IN"
  | "hi-IN"
  | "hi-en"
  | "bn-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "mr-IN"
  | "pa-IN"
  | "ta-IN"
  | "te-IN";

export interface VoiceLanguageOption {
  code: VoiceLanguageCode;
  label: string;
  native: string;
  short: string;
  /** BCP-47 tag handed to the browser speechSynthesis fallback. */
  browserVoice: string;
}

/** Structured preferences produced by interpretation (Sarvam / mock / local parser). */
export interface VoicePreferences {
  categories?: string[];
  interests?: string[];
  remote?: boolean;
  location?: string;
  experience?: string;
}

/** One visible "we understood this" chip in the Understanding panel. */
export interface VoiceSignal {
  key: "category" | "interests" | "remote" | "location" | "experience";
  label: string;
  value: string;
  /** The phrase in the user's words that triggered the signal, when known. */
  matchedOn?: string;
}

/** How preference extraction produced the preferences. */
export type VoiceInterpretSource = "mock" | "sarvam" | "local";

/** Which engine each leg of the pipeline will use right now. */
export interface VoiceEngineStatus {
  stt: "prisma" | "demo" | "unavailable";
  tts: "timbre" | "demo";
  ttsModel: string;
  ttsVoice: string;
  /** True only when a live Gnani credential is configured and mock mode is off. */
  ready: boolean;
}

export interface SttResponse {
  transcript: string;
  engine: "prisma" | "demo";
  requestId?: string;
  durationMs: number;
}

/** JSON bodies returned by POST /api/tts when no audio was produced. */
export type TtsJsonResponse =
  | { mode: "demo"; reason: string }
  | { mode: "error"; message: string };

/** Why the voice page fell back to typed input. */
export type SttErrorCode = "SERVICE_UNAVAILABLE" | "TRANSCRIPTION_FAILED" | "EMPTY_AUDIO";

/** A ranked result card, mirroring the browse results overlay. */
export interface VoiceResultItem {
  opportunity: OpportunityDocument;
  /** 0–100 match percentage derived from the relevance score. */
  matchPercent: number;
  matchLevel: "strong" | "good" | "related" | "broad";
  matchLabels: string[];
}

export interface VoiceResultGroup {
  /** Group heading rendered in the UI. */
  heading: string;
  items: VoiceResultItem[];
}

export interface VoiceDiscoverResponse {
  query: string;
  language: VoiceLanguageCode;
  preferences: VoicePreferences;
  signals: VoiceSignal[];
  /** 0–1 confidence derived from how many structured signals were extracted. */
  confidence: number;
  /** Human-readable result summary (also used as the spoken reply). */
  summary: string;
  /** Localized spoken reply — may differ from `summary` for non-English languages. */
  spokenSummary: string;
  /** Grouped, ranked, real OPPY opportunities (excluded items are dropped). */
  groups: VoiceResultGroup[];
  /** Number of visible results across all groups. */
  total: number;
  /** Number of candidates the relevance engine marked as irrelevant. */
  excluded: number;
  /** Same URL the browse page uses for these preferences — for "see all". */
  browseUrl: string;
  interpretSource: VoiceInterpretSource;
  engine: VoiceEngineStatus;
  tookMs: number;
}

export interface VoiceStatusResponse {
  engine: VoiceEngineStatus;
}
