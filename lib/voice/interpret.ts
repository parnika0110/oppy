/**
 * Voice query → structured OPPY preferences.
 *
 * Extraction order (every step is offline-safe):
 *   1. SARVAM_MOCK=true  → Sarvam mock fixtures (lib/sarvam/mock.ts)
 *   2. GNANI_MOCK=true   → the whole voice stack is in demo mode, so skip all
 *                          external APIs and use the local deterministic parser
 *   3. Sarvam configured → live interpretation (same engine /api/ai/interpret uses)
 *   4. otherwise         → local deterministic parser (lib/search-intent.ts)
 *
 * The output feeds OPPY's existing search/filter/ranking — this module never
 * fetches opportunities itself.
 */

import { parseSearchQuery } from "@/lib/search-intent";
import { getMockInterpretation, type MockPreferences } from "@/lib/sarvam/mock";
import { interpretQuery, isSarvamConfigured } from "@/lib/sarvam/client";
import { CATEGORIES } from "@/types/opportunity";
import type {
  VoiceInterpretSource,
  VoiceLanguageCode,
  VoicePreferences,
  VoiceSignal,
} from "@/types/voice";

export interface VoiceInterpretation {
  preferences: VoicePreferences;
  /** Leftover keyword terms from the local parser — used as the text-search clause. */
  keywords: string[];
  signals: VoiceSignal[];
  /** 0–1 confidence derived from how many structured signals were extracted. */
  confidence: number;
  source: VoiceInterpretSource;
}

function readBool(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function validCategories(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter((c): c is string =>
    typeof c === "string" && (CATEGORIES as readonly string[]).includes(c)
  );
  return valid.length > 0 ? [...new Set(valid)] : undefined;
}

function cleanList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return items.length > 0 ? [...new Set(items.map((i) => i.trim()))] : undefined;
}

/** Normalize any extractor output (mock / Sarvam / local) into VoicePreferences. */
export function normalizeVoicePreferences(raw: {
  category?: string[];
  categories?: string[];
  interests?: string[];
  remote?: boolean;
  location?: string;
  experience?: string;
}): VoicePreferences {
  const categories = validCategories(raw.categories ?? raw.category);
  const interests = cleanList(raw.interests);
  const location =
    typeof raw.location === "string" && raw.location.trim() ? raw.location.trim() : undefined;
  const experience =
    typeof raw.experience === "string" && raw.experience.trim() ? raw.experience.trim() : undefined;
  return {
    categories,
    interests,
    remote: raw.remote === true ? true : undefined,
    location,
    experience,
  };
}

/** Visible "we understood this" chips for the Understanding panel. */
export function buildVoiceSignals(prefs: VoicePreferences): VoiceSignal[] {
  const signals: VoiceSignal[] = [];
  if (prefs.categories?.length) {
    signals.push({ key: "category", label: "Type", value: prefs.categories.join(", ") });
  }
  if (prefs.interests?.length) {
    signals.push({ key: "interests", label: "Focus", value: prefs.interests.join(", ") });
  }
  if (prefs.remote) {
    signals.push({ key: "remote", label: "Mode", value: "Remote", matchedOn: "remote" });
  }
  if (prefs.location) {
    signals.push({ key: "location", label: "Location", value: prefs.location });
  }
  if (prefs.experience) {
    signals.push({ key: "experience", label: "For", value: prefs.experience });
  }
  return signals;
}

/** 0–1 confidence from signal count: more structured signals → higher confidence. */
export function computeConfidence(signalCount: number): number {
  const table = [0.2, 0.5, 0.7, 0.82, 0.92, 0.97];
  const index = Math.min(Math.max(signalCount, 0), table.length - 1);
  return table[index];
}

function hasStructuredSignals(prefs: VoicePreferences): boolean {
  return Boolean(
    prefs.categories?.length ||
      prefs.interests?.length ||
      prefs.remote ||
      prefs.location ||
      prefs.experience
  );
}

/**
 * Devanagari supplements for the local parser — OPPY's shared
 * lib/search-intent.ts stays Latin-first, but the voice demo must handle
 * pure Hindi queries. Live Sarvam interpretation covers the full spectrum;
 * these rules cover the common Hindi voice vocabulary offline.
 */
const HINDI_CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: "Internship", pattern: /इंटर्नशिप|इंटर्न/i },
  { category: "Job", pattern: /नौकरी|जॉब/ },
  { category: "Hackathon", pattern: /हैकाथॉन|हैकथॉन|हैकathon/ },
  { category: "Fellowship", pattern: /फेलोशिप|फ़ेलोशिप/ },
  { category: "Scholarship", pattern: /छात्रवृत्ति|छात्रवृति|स्कॉलरशिप/ },
  { category: "Grant", pattern: /अनुदान/ },
  { category: "Event", pattern: /इवेंट/ },
];

const HINDI_INTEREST_RULES: Array<{ interest: string; pattern: RegExp }> = [
  { interest: "AI / ML", pattern: /एआई|ए\.आई|आर्टिफिशियल इंटेलिजेंस|मशीन लर्निंग/ },
  { interest: "Web Development", pattern: /वेब डेवलपमेंट|फ्रंटएंड|बैकएंड/ },
  { interest: "Data Science", pattern: /डेटा साइंस/ },
  { interest: "Software Engineering", pattern: /सॉफ़्टवेयर इंजीनियर|प्रोग्रामिंग/ },
];

const HINDI_REMOTE = /रिमोट|वर्क फ्रॉम होम|घरबैठे|ऑनलाइन/;
const HINDI_STUDENT = /स्टूडेंट|विद्यार्थी|छात्र/;
const DEVANAGARI = /[\u0900-\u097F]/;

/** Merge Devanagari signals into parsed preferences (no-op for Latin text). */
function supplementHindiSignals(query: string, prefs: VoicePreferences): VoicePreferences {
  if (!DEVANAGARI.test(query)) return prefs;

  const categories = [...(prefs.categories || [])];
  for (const rule of HINDI_CATEGORY_RULES) {
    if (rule.pattern.test(query) && !categories.includes(rule.category)) {
      categories.push(rule.category);
    }
  }

  const interests = [...(prefs.interests || [])];
  for (const rule of HINDI_INTEREST_RULES) {
    if (rule.pattern.test(query) && !interests.includes(rule.interest)) {
      interests.push(rule.interest);
    }
  }

  return {
    categories: categories.length > 0 ? categories : prefs.categories,
    interests: interests.length > 0 ? interests : prefs.interests,
    remote: prefs.remote ?? (HINDI_REMOTE.test(query) ? true : undefined),
    location: prefs.location,
    experience: prefs.experience ?? (HINDI_STUDENT.test(query) ? "Student" : undefined),
  };
}

function fromLocalParse(query: string): { prefs: VoicePreferences; keywords: string[] } {
  const intent = parseSearchQuery(query);
  const prefs = normalizeVoicePreferences({
    categories: intent.categories,
    interests: intent.interests,
    remote: intent.remote,
    location: intent.location,
    experience: intent.experience,
  });
  return {
    prefs: supplementHindiSignals(query, prefs),
    keywords: intent.keywords,
  };
}

/**
 * Interpret a (possibly transcribed) voice query into structured preferences.
 * Never throws — degrades to the local deterministic parser on any failure.
 */
export async function interpretVoiceQuery(
  query: string,
  language?: VoiceLanguageCode | string
): Promise<VoiceInterpretation> {
  const trimmed = query.trim();

  // 1. Explicit Sarvam mock mode (shared with /api/ai/interpret).
  if (readBool(process.env.SARVAM_MOCK)) {
    const fixture = getMockInterpretation(trimmed) as MockPreferences | null;
    if (fixture) {
      const prefs = supplementHindiSignals(trimmed, normalizeVoicePreferences(fixture));
      if (hasStructuredSignals(prefs)) {
        const signals = buildVoiceSignals(prefs);
        return { preferences: prefs, keywords: [], signals, confidence: computeConfidence(signals.length), source: "mock" };
      }
    }
    const local = fromLocalParse(trimmed);
    const signals = buildVoiceSignals(local.prefs);
    return { preferences: local.prefs, keywords: local.keywords, signals, confidence: computeConfidence(signals.length), source: "local" };
  }

  // 2. Whole voice stack in demo mode → zero external API calls.
  if (readBool(process.env.GNANI_MOCK)) {
    const local = fromLocalParse(trimmed);
    const signals = buildVoiceSignals(local.prefs);
    return { preferences: local.prefs, keywords: local.keywords, signals, confidence: computeConfidence(signals.length), source: "local" };
  }

  // 3. Live Sarvam interpretation (same engine as the existing AI quick search).
  if (isSarvamConfigured()) {
    try {
      const result = await interpretQuery(trimmed, String(language || "en").split("-")[0]);
      if (result) {
        const prefs = supplementHindiSignals(trimmed, normalizeVoicePreferences(result));
        if (hasStructuredSignals(prefs)) {
          const signals = buildVoiceSignals(prefs);
          return { preferences: prefs, keywords: [], signals, confidence: computeConfidence(signals.length), source: "sarvam" };
        }
      }
    } catch {
      /* fall through to the local parser */
    }
  }

  // 4. Deterministic local parser — no network, works offline.
  const local = fromLocalParse(trimmed);
  const signals = buildVoiceSignals(local.prefs);
  return { preferences: local.prefs, keywords: local.keywords, signals, confidence: computeConfidence(signals.length), source: "local" };
}
