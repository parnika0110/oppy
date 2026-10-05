/**
 * Deterministic demo fixtures for the voice pipeline.
 *
 * When GNANI_MOCK=true the voice stack runs fully offline:
 *   - POST /api/stt returns a canned transcript instead of calling Gnani Prisma
 *   - POST /api/tts reports demo mode so the browser speechSynthesis fallback
 *     takes over instead of calling Gnani Timbre
 *   - preference interpretation skips every external API (see lib/voice/interpret.ts)
 *
 * Fixtures are chosen so the demo pipeline flows through OPPY's REAL discovery
 * engine and returns REAL MongoDB opportunities — never mock opportunity data.
 */

import type { VoiceLanguageCode } from "@/types/voice";

interface DemoTranscript {
  transcript: string;
  requestId: string;
}

/**
 * Language-keyed demo transcripts (lowercase BCP-47 keys), Devanagari for
 * Hindi, code-mixed for Hinglish.
 */
const DEMO_TRANSCRIPTS: Record<string, string> = {
  "en-in": "Find me remote AI internships I can apply for in November",
  "hi-in": "दिसंबर तक रिमोट एआई इंटर्नशिप चाहिए",
  "hi-en": "Remote AI internship chahiye students ke liye India mein",
  "bn-in": "রিমোট এআই ইন্টার্নশিপ খুঁজছি",
  "gu-in": "રિમોટ એઆઈ ઇન્ટર્નશિપ શોધી રહ્યો છું",
  "kn-in": "ರಿಮೋಟ್ ಎಐ ಇಂಟರ್ನ್‌ಶಿಪ್ ಹುಡುಕುತ್ತಿದ್ದೇನೆ",
  "ml-in": "റിമോട്ട് എഐ ഇന്റർൻഷിപ്പ് തിരയുന്നു",
  "mr-in": "रिमोट एआय इंटर्नशिप शोधत आहे",
  "pa-in": "ਰਿਮੋਟ ਏਈ ਇੰਟਰਨਸ਼ਿਪ ਲੱਭ ਰਿਹਾ ਹਾਂ",
  "ta-in": "தொலைநிலை ஏஐ இன்டர்ன்ஷிப்பைத் தேடுகிறேன்",
  "te-in": "రిమోట్ ఎఐ ఇంటర్న్‌షిప్ వెతుకుతున్నాను",
};

/**
 * Demo transcript for the requested language.
 * Always returns a usable query so the full pipeline can be exercised offline.
 */
export function getMockTranscript(language?: string): DemoTranscript {
  const code = (language || "en-IN").toLowerCase();
  const family = code.split("-")[0];
  const transcript =
    DEMO_TRANSCRIPTS[code] || DEMO_TRANSCRIPTS[family] || DEMO_TRANSCRIPTS["en-in"];
  return { transcript, requestId: `demo-${family}` };
}

/** Demo reason returned by POST /api/tts when no live credential exists. */
export const TTS_DEMO_REASON = "Gnani Timbre is not configured — using the browser voice.";

/** Localized empty-result spoken replies (deterministic, no network). */
export function getEmptySpokenSummary(language: VoiceLanguageCode | string): string {
  const family = String(language).toLowerCase().split("-")[0];
  if (family === "hi") {
    const hinglish = String(language).toLowerCase().startsWith("hi-en");
    return hinglish
      ? "Koi matching opportunity nahi mila. Search thoda broad karo ya dusra keyword try karo."
      : "मुझे मेल खाते अवसर नहीं मिले। अपनी खोज थोड़ी व्यापक करें या कोई और कीवर्ड आज़माएँ।";
  }
  return "I could not find matching opportunities. Try broadening your search or use different keywords.";
}
