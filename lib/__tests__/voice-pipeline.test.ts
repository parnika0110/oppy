/**
 * Voice pipeline tests — fully deterministic, ZERO network calls.
 *
 * Env safety: every test forces GNANI_MOCK / SARVAM_MOCK so neither Gnani
 * nor Sarvam credits can ever be consumed, even if .env.local is loaded.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildVoiceSignals,
  computeConfidence,
  interpretVoiceQuery,
  normalizeVoicePreferences,
} from "@/lib/voice/interpret";
import {
  buildBrowseUrl,
  buildSpokenSummary,
  groupRanked,
  matchPercentOf,
} from "@/lib/voice/discover";
import { getGnaniEngineStatus, isGnaniConfigured, isGnaniMock } from "@/lib/voice/config";
import { getMockTranscript, getEmptySpokenSummary } from "@/lib/voice/mock";
import { extensionForMimeType } from "@/lib/voice/client";
import { getExamplePrompts, VOICE_LANGUAGES } from "@/lib/voice/languages";
import type { RankedOpportunity } from "@/lib/relevance";
import type { OpportunityDocument } from "@/types/opportunity";

// ── Environment isolation ────────────────────────────────────────────────

const ENV_KEYS = ["GNANI_MOCK", "GNANI_API_KEY", "SARVAM_MOCK", "SARVAM_API_KEY"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  // Default to full demo mode: no external API may ever be reached.
  process.env.GNANI_MOCK = "true";
  process.env.SARVAM_MOCK = "true";
  delete process.env.GNANI_API_KEY;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

// ── Preference interpretation ────────────────────────────────────────────

describe("interpretVoiceQuery — local deterministic parser (no network)", () => {
  beforeEach(() => {
    process.env.GNANI_MOCK = "true"; // skips every external API
    delete process.env.SARVAM_MOCK;
  });

  it("extracts structured preferences from an English voice query", async () => {
    const result = await interpretVoiceQuery(
      "remote AI internships for students in India",
      "en-IN"
    );
    expect(result.source).toBe("local");
    expect(result.preferences.categories).toEqual(["Internship"]);
    expect(result.preferences.interests).toContain("AI / ML");
    expect(result.preferences.remote).toBe(true);
    expect(result.preferences.location).toBe("India");
    expect(result.preferences.experience).toBe("Student");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("handles a Hindi (Devanagari) query without crashing and finds भारत", async () => {
    const result = await interpretVoiceQuery("भारत में इंटर्नशिप चाहिए", "hi-IN");
    expect(result.source).toBe("local");
    expect(result.preferences.location).toBe("India");
    expect(result.preferences.categories).toEqual(["Internship"]);
    // Devanagari tokens must not leak into the ASCII keyword clause
    expect(result.keywords.every((k) => /^[\x20-\x7e]+$/.test(k))).toBe(true);
  });

  it("extracts full Hindi signals from the hi-IN demo transcript", async () => {
    const demo = getMockTranscript("hi-IN").transcript; // दिसंबर तक रिमोट एआई इंटर्नशिप चाहिए
    const result = await interpretVoiceQuery(demo, "hi-IN");
    expect(result.preferences.categories).toEqual(["Internship"]);
    expect(result.preferences.interests).toContain("AI / ML");
    expect(result.preferences.remote).toBe(true);
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
  });

  it("handles Hinglish (code-mixed) queries", async () => {
    const result = await interpretVoiceQuery("Bangalore mein fresher jobs", "hi-en");
    expect(result.preferences.location).toBe("Bengaluru");
    expect(result.preferences.categories).toEqual(["Job"]);
  });

  it("degrades gracefully on an unstructured query", async () => {
    const result = await interpretVoiceQuery("hello", "en-IN");
    expect(result.source).toBe("local");
    expect(result.signals.length).toBe(0);
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe("interpretVoiceQuery — SARVAM_MOCK fixtures", () => {
  it("uses mock fixtures when SARVAM_MOCK=true", async () => {
    const result = await interpretVoiceQuery(
      "I want remote AI internships for students in India",
      "en-IN"
    );
    expect(result.source).toBe("mock");
    expect(result.preferences.categories).toEqual(["Internship"]);
    expect(result.preferences.remote).toBe(true);
  });

  it("merges Devanagari signals into fixture output (Type + Mode survive)", async () => {
    // Regression: the fixture path early-returned before the Hindi supplement ran,
    // so a Hindi query lost Type/Mode and fell back to all-broad results.
    const result = await interpretVoiceQuery("भारत में रिमोट AI इंटर्नशिप चाहिए", "hi-IN");
    expect(result.preferences.categories).toContain("Internship");
    expect(result.preferences.remote).toBe(true);
    expect(result.preferences.interests).toContain("AI / ML");
    const keys = result.signals.map((s) => s.key);
    expect(keys).toContain("category");
    expect(keys).toContain("remote");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("still extracts correct preferences for non-fixture queries (deterministic fallback)", async () => {
    const result = await interpretVoiceQuery("internship in pune", "en-IN");
    // The mock module falls back to parseSearchQuery — content must stay correct.
    expect(["mock", "local"]).toContain(result.source);
    expect(result.preferences.categories).toEqual(["Internship"]);
    expect(result.preferences.location).toBe("Pune");
  });
});

describe("signals + confidence", () => {
  it("builds one chip per structured signal", () => {
    const signals = buildVoiceSignals({
      categories: ["Internship"],
      interests: ["AI / ML"],
      remote: true,
      location: "India",
      experience: "Student",
    });
    expect(signals.map((s) => s.key)).toEqual([
      "category",
      "interests",
      "remote",
      "location",
      "experience",
    ]);
    expect(buildVoiceSignals({})).toEqual([]);
  });

  it("confidence rises with signal count and stays within 0–1", () => {
    const values = [0, 1, 2, 3, 4, 5].map(computeConfidence);
    for (const value of values) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    expect(computeConfidence(99)).toBeLessThanOrEqual(1);
  });

  it("normalizes and rejects invalid categories", () => {
    const prefs = normalizeVoicePreferences({
      category: ["Internship", "NotACategory"],
      interests: ["AI / ML", ""],
      remote: false,
    });
    expect(prefs.categories).toEqual(["Internship"]);
    expect(prefs.interests).toEqual(["AI / ML"]);
    expect(prefs.remote).toBeUndefined();
  });
});

// ── Discovery grouping + URLs + spoken summaries ─────────────────────────

function fakeRanked(level: RankedOpportunity["matchLevel"], index: number): RankedOpportunity {
  const opportunity = {
    _id: `id-${level}-${index}`,
    title: `Opportunity ${index}`,
    organization: `Org ${index}`,
    category: "Internship",
  } as unknown as OpportunityDocument;
  return {
    opportunity,
    score: { total: 60, category: 30, interests: 20, location: 5, experience: 3, freshness: 2 },
    matchLevel: level,
    matchLabels: ["Internship"],
  };
}

describe("groupRanked", () => {
  it("splits into strong/good, related and broad groups and drops excludes", () => {
    const ranked: RankedOpportunity[] = [
      fakeRanked("strong", 1),
      fakeRanked("good", 2),
      fakeRanked("related", 3),
      fakeRanked("broad", 4),
      fakeRanked("exclude", 5),
    ];
    const groups = groupRanked(ranked);
    expect(groups.map((g) => g.heading)).toEqual([
      "Strong matches",
      "Related opportunities",
      "Broader picks",
    ]);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
    expect(groups[2].items).toHaveLength(1);
    const allIds = groups.flatMap((g) => g.items.map((i) => i.opportunity._id));
    expect(allIds).not.toContain("id-exclude-5");
  });

  it("caps broad fallback at 6 while keeping strong+good at 12", () => {
    const ranked = [
      ...Array.from({ length: 20 }, (_, i) => fakeRanked("strong", i)),
      ...Array.from({ length: 20 }, (_, i) => fakeRanked("broad", i)),
    ];
    const groups = groupRanked(ranked);
    expect(groups[0].items).toHaveLength(12);
    expect(groups[1].items).toHaveLength(6);
  });

  it("produces match percentages within 5–99", () => {
    expect(matchPercentOf(-50)).toBe(5);
    expect(matchPercentOf(0)).toBe(5);
    expect(matchPercentOf(85)).toBe(99);
    expect(matchPercentOf(60)).toBeGreaterThanOrEqual(50);
    expect(matchPercentOf(60)).toBeLessThan(99);
  });
});

describe("buildBrowseUrl", () => {
  it("produces the same param shape as the AI quick search", () => {
    const url = buildBrowseUrl(
      {
        categories: ["Internship"],
        interests: ["AI / ML"],
        remote: true,
        location: "India",
        experience: "Student",
      },
      ["python"]
    );
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("categories")).toBe("Internship");
    expect(params.get("interests")).toBe("AI / ML");
    expect(params.get("remote")).toBe("true");
    expect(params.get("location")).toBe("India");
    expect(params.get("experience")).toBe("Student");
    expect(params.get("q")).toBe("python");
    expect(params.get("sort")).toBe("recommended");
  });

  it("omits empty fields and never invents remote", () => {
    const url = buildBrowseUrl({ categories: ["Job"] });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("remote")).toBeNull();
    expect(params.get("location")).toBeNull();
    expect(url.startsWith("/?")).toBe(true);
  });
});

describe("buildSpokenSummary", () => {
  const args = {
    total: 12,
    strong: 5,
    good: 3,
    related: 2,
    top: { title: "AI Research Intern", organization: "OpenAI" },
  };

  it("returns an English summary with the count and top match", () => {
    const spoken = buildSpokenSummary({ ...args, language: "en-IN" });
    expect(spoken).toContain("12 opportunities");
    expect(spoken).toContain("5 strong");
    expect(spoken).toContain("AI Research Intern");
  });

  it("returns a Hindi Devanagari summary for hi-IN", () => {
    const spoken = buildSpokenSummary({ ...args, language: "hi-IN" });
    expect(spoken).toMatch(/[ऀ-ॿ]/);
    expect(spoken).toContain("12");
  });

  it("returns a Hinglish summary for hi-en", () => {
    const spoken = buildSpokenSummary({ ...args, language: "hi-en" });
    expect(spoken).toContain("mil gaye");
    expect(spoken).toContain("strong");
  });

  it("handles the empty result case in every language family", () => {
    expect(buildSpokenSummary({ total: 0, strong: 0, good: 0, related: 0, language: "en-IN" })).toMatch(
      /could not find/i
    );
    expect(buildSpokenSummary({ total: 0, strong: 0, good: 0, related: 0, language: "hi-IN" })).toMatch(
      /[ऀ-ॿ]/
    );
    expect(getEmptySpokenSummary("hi-en")).toMatch(/nahi mila/i);
  });

  it("clips very long titles so speech stays concise", () => {
    const spoken = buildSpokenSummary({
      total: 1,
      strong: 1,
      good: 0,
      related: 0,
      top: { title: "X".repeat(200) },
      language: "en-IN",
    });
    expect(spoken.length).toBeLessThan(320);
  });

  it("breakdown counts always sum to the reported total (incl. broader)", () => {
    const counts = { strong: 20, good: 3, related: 71, broad: 6 };
    const total = counts.strong + counts.good + counts.related + counts.broad;
    const spoken = buildSpokenSummary({ ...counts, total, language: "en-IN" });
    expect(spoken).toContain(`${total} opportunities`);
    expect(spoken).toContain("20 strong");
    expect(spoken).toContain("3 good");
    expect(spoken).toContain("71 related");
    expect(spoken).toContain("6 broader");
  });

  it("omits the broader segment when there are no broad matches", () => {
    const spoken = buildSpokenSummary({
      total: 5,
      strong: 5,
      good: 0,
      related: 0,
      language: "en-IN",
    });
    expect(spoken).not.toContain("broader");
  });
});

// ── Demo fixtures + config status ────────────────────────────────────────

describe("GNANI_MOCK fixtures", () => {
  it("returns a localized demo transcript (Hindi in Devanagari)", () => {
    const hi = getMockTranscript("hi-IN");
    expect(hi.transcript).toMatch(/[ऀ-ॿ]/);
    const en = getMockTranscript("en-IN");
    expect(en.transcript).toContain("internships");
    expect(en.requestId).toBe("demo-en");
  });

  it("falls back to English for unknown languages", () => {
    expect(getMockTranscript("").transcript).toBe(getMockTranscript("en-IN").transcript);
    expect(getMockTranscript("xx-XX").transcript).toBe(getMockTranscript("en-IN").transcript);
    expect(getMockTranscript("ta-IN").requestId).toBe("demo-ta");
  });
});

describe("engine status (config only)", () => {
  it("reports demo mode when GNANI_MOCK=true even with a key present", () => {
    process.env.GNANI_API_KEY = "test-key";
    process.env.GNANI_MOCK = "true";
    expect(isGnaniMock()).toBe(true);
    expect(isGnaniConfigured()).toBe(false);
    const status = getGnaniEngineStatus();
    expect(status.stt).toBe("demo");
    expect(status.tts).toBe("demo");
    expect(status.ready).toBe(false);
  });

  it("reports live engines when a key is present and mock is off", () => {
    process.env.GNANI_API_KEY = "test-key";
    process.env.GNANI_MOCK = "false";
    expect(isGnaniConfigured()).toBe(true);
    const status = getGnaniEngineStatus();
    expect(status.stt).toBe("prisma");
    expect(status.tts).toBe("timbre");
    expect(status.ready).toBe(true);
    // The key itself must never appear in the status payload
    expect(JSON.stringify(status)).not.toContain("test-key");
  });

  it("reports unavailable without a key", () => {
    process.env.GNANI_MOCK = "false";
    expect(isGnaniConfigured()).toBe(false);
    expect(getGnaniEngineStatus().stt).toBe("unavailable");
  });
});

describe("Gnani client helpers", () => {
  it("maps recording MIME types to file extensions", () => {
    expect(extensionForMimeType("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMimeType("audio/ogg")).toBe("ogg");
    expect(extensionForMimeType("audio/mp4")).toBe("m4a");
    expect(extensionForMimeType("audio/mpeg")).toBe("mp3");
    expect(extensionForMimeType("")).toBe("webm");
  });
});

// ── Language catalogue ───────────────────────────────────────────────────

describe("language support", () => {
  it("exposes all 11 languages with browser voices", () => {
    expect(VOICE_LANGUAGES).toHaveLength(11);
    const codes = VOICE_LANGUAGES.map((l) => l.code);
    expect(codes).toContain("en-IN");
    expect(codes).toContain("hi-IN");
    expect(codes).toContain("hi-en");
    for (const lang of VOICE_LANGUAGES) {
      expect(lang.browserVoice).toBeTruthy();
      expect(lang.native).toBeTruthy();
    }
  });

  it("provides localized prompts for English, Hindi and Hinglish", () => {
    expect(getExamplePrompts("en-IN").length).toBeGreaterThan(0);
    expect(getExamplePrompts("hi-IN").join(" ")).toMatch(/[ऀ-ॿ]/);
    expect(getExamplePrompts("hi-en").length).toBeGreaterThan(0);
    // Unknown code falls back to English prompts
    expect(getExamplePrompts("ta-IN").length).toBeGreaterThan(0);
  });
});

// ── Secret hygiene: no key/env access in client-shipped voice files ──────

describe("no secrets in client code", () => {
  const clientFiles = [
    "components/voice/VoiceExperience.tsx",
    "components/voice/VoiceStage.tsx",
    "components/voice/Understanding.tsx",
    "components/voice/VoiceResults.tsx",
    "components/voice/RecentSearches.tsx",
    "app/voice/page.tsx",
    "lib/voice/recorder.ts",
    "lib/voice/speech.ts",
    "lib/voice/languages.ts",
  ];

  it.each(clientFiles)("%s never references the Gnani key or process.env", (file) => {
    const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    expect(content).not.toContain("GNANI_API_KEY");
    expect(content).not.toContain("process.env");
    expect(content).not.toContain("X-API-Key-ID");
    expect(content).not.toContain("SARVAM_API_KEY");
  });
});
