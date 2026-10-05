/**
 * Language support for the OPPY voice interface.
 *
 * Ported from the Gnani app's shared constants — codes map to Gnani Prisma
 * `language_code` values; `browserVoice` is the BCP-47 tag handed to the
 * browser speechSynthesis fallback when Timbre is unavailable.
 *
 * Client-safe: no environment access, importable from both server and
 * browser code.
 */

import type { VoiceLanguageOption } from "@/types/voice";

export const VOICE_LANGUAGES: VoiceLanguageOption[] = [
  { code: "en-IN", label: "English", native: "English", short: "EN", browserVoice: "en-IN" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी", short: "हि", browserVoice: "hi-IN" },
  { code: "hi-en", label: "Hinglish", native: "Hinglish", short: "Hing", browserVoice: "hi-IN" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা", short: "বাং", browserVoice: "bn-IN" },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી", short: "ગુજ", browserVoice: "gu-IN" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ", short: "ಕ", browserVoice: "kn-IN" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം", short: "മ", browserVoice: "ml-IN" },
  { code: "mr-IN", label: "Marathi", native: "मराठी", short: "मरा", browserVoice: "mr-IN" },
  { code: "pa-IN", label: "Punjabi", native: "ਪੰਜਾਬੀ", short: "ਪ", browserVoice: "pa-IN" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்", short: "த", browserVoice: "ta-IN" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు", short: "తె", browserVoice: "te-IN" },
];

export function getVoiceLanguageOption(code: string): VoiceLanguageOption {
  return (
    VOICE_LANGUAGES.find((entry) => entry.code === code) || VOICE_LANGUAGES[0]
  );
}

/**
 * Suggested spoken/typed queries shown under the microphone.
 * English, Hindi and Hinglish get localized prompts (parity with the source
 * app); the remaining languages fall back to the English set.
 */
export const VOICE_EXAMPLE_PROMPTS: Record<string, string[]> = {
  "en-IN": [
    "Remote AI internship before December",
    "Any hackathon happening this month",
    "Scholarship for second year students",
    "Jobs in Bengaluru for freshers",
  ],
  "hi-IN": [
    "दिसंबर तक रिमोट एआई इंटर्नशिप चाहिए",
    "इस महीने कोई हैकाथॉन हो रहा है क्या",
    "दूसरे साल के स्टूडेंट्स के लिए स्कॉलरशिप",
    "बेंगलुरु में फ्रेशर्स के लिए जॉब्स",
  ],
  "hi-en": [
    "Remote AI internship chahiye students ke liye",
    "December tak koi hackathon hai kya",
    "Second year students ke liye scholarship",
    "Bangalore mein fresher jobs",
  ],
};

export function getExamplePrompts(code: string): string[] {
  return (
    VOICE_EXAMPLE_PROMPTS[code] ||
    VOICE_EXAMPLE_PROMPTS[getVoiceLanguageOption(code).code] ||
    VOICE_EXAMPLE_PROMPTS["en-IN"]
  );
}
