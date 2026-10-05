"use client";

/**
 * Ask OPPY — voice experience orchestrator.
 *
 * State machine:
 *   mic → POST /api/stt (Gnani Prisma) → transcript
 *   → POST /api/voice/discover (OPPY interpretation + REAL MongoDB discovery
 *     + lib/relevance ranking) → grouped results + spoken summary
 *   → POST /api/tts (Gnani Timbre) → spoken reply (browser voice fallback)
 *
 * Typed fallback is always available: the transcript field is editable and
 * submits without microphone access.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import RecentSearches from "@/components/voice/RecentSearches";
import Understanding from "@/components/voice/Understanding";
import VoiceResults from "@/components/voice/VoiceResults";
import VoiceStage from "@/components/voice/VoiceStage";
import { VOICE_LANGUAGES, getExamplePrompts } from "@/lib/voice/languages";
import { useVoiceRecorder } from "@/lib/voice/recorder";
import { speak, stopSpeaking } from "@/lib/voice/speech";
import type {
  VoiceDiscoverResponse,
  VoiceEngineStatus,
  VoiceLanguageCode,
} from "@/types/voice";

export type VoicePhase =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "done"
  | "error";

const LANGUAGE_KEY = "oppy:voice:language";
const RECENT_KEY = "oppy:voice:recent";

export default function VoiceExperience() {
  const [language, setLanguage] = useState<VoiceLanguageCode>("en-IN");
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceDiscoverResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<VoiceEngineStatus | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakState, setSpeakState] = useState<"idle" | "loading" | "speaking">("idle");
  const [speakFallback, setSpeakFallback] = useState<string | null>(null);

  const languageRef = useRef(language);
  languageRef.current = language;
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  // Stable late-bound callbacks (recorder max-reached fires from a timer).
  const runQueryRef = useRef<(query: string) => Promise<void>>(async () => {});
  const handleAudioRef = useRef<(blob: Blob) => Promise<void>>(async () => {});

  const handleMaxReached = useCallback((blob: Blob) => {
    void handleAudioRef.current(blob);
  }, []);

  const recorder = useVoiceRecorder({ maxMs: 55_000, onMaxReached: handleMaxReached });

  // ── Boot: engine status + persisted language/recent searches ──────────
  useEffect(() => {
    fetch("/api/voice/status")
      .then((res) => res.json())
      .then((data) => {
        if (data?.engine) setEngine(data.engine as VoiceEngineStatus);
      })
      .catch(() => undefined);

    try {
      const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage && VOICE_LANGUAGES.some((l) => l.code === savedLanguage)) {
        setLanguage(savedLanguage as VoiceLanguageCode);
      }
      const savedRecent = localStorage.getItem(RECENT_KEY);
      if (savedRecent) {
        const parsed = JSON.parse(savedRecent) as unknown;
        if (Array.isArray(parsed)) {
          setRecent(parsed.filter((v): v is string => typeof v === "string").slice(0, 5));
        }
      }
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, []);

  // Mic failure (permission denied, no device…) → drop back to typed input.
  useEffect(() => {
    if (recorder.error) {
      setError(recorder.error);
      setPhase((current) =>
        current === "listening" || current === "transcribing" ? "idle" : current
      );
    }
  }, [recorder.error]);

  // Stop any speech when the page unmounts.
  useEffect(() => stopSpeaking, []);

  const pushRecent = useCallback((query: string) => {
    setRecent((previous) => {
      const next = [query, ...previous.filter((item) => item !== query)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const runQuery = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      stopSpeaking();
      setSpeakState("idle");
      setSpeakFallback(null);
      setPhase("thinking");
      setError(null);
      try {
        const res = await fetch("/api/voice/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, language: languageRef.current }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.groups) {
          setError(data?.error || "OPPY could not search right now. Please try again.");
          setPhase("error");
          return;
        }
        const discovered = data as VoiceDiscoverResponse;
        setResult(discovered);
        setPhase("done");
        pushRecent(q);
        if (autoSpeakRef.current && discovered.spokenSummary) {
          speak(discovered.spokenSummary, languageRef.current, {
            onState: setSpeakState,
            onFallback: setSpeakFallback,
          });
        }
      } catch {
        setError("Could not reach OPPY. Check your connection and try again.");
        setPhase("error");
      }
    },
    [pushRecent]
  );
  runQueryRef.current = runQuery;

  /** Recorded audio → Prisma transcript → discovery. */
  const handleAudio = useCallback(
    async (blob: Blob) => {
      setPhase("transcribing");
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        form.append("language", languageRef.current);
        const res = await fetch("/api/stt", { method: "POST", body: form });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error || "Voice input is unavailable. Type your search instead.");
          setPhase("error");
          return;
        }
        const text = String(data?.transcript || "").trim();
        if (!text) {
          setError("Could not understand the audio. Please type your search.");
          setPhase("error");
          return;
        }
        setTranscript(text);
        await runQuery(text);
      } catch {
        setError("Voice input failed. Type your search instead.");
        setPhase("error");
      }
    },
    [runQuery]
  );
  handleAudioRef.current = handleAudio;

  const toggleMic = useCallback(async () => {
    setError(null);
    if (recorder.status === "listening") {
      const blob = await recorder.stop();
      if (blob) {
        await handleAudioRef.current(blob);
      } else {
        setPhase((current) => (current === "listening" ? "idle" : current));
      }
      return;
    }
    stopSpeaking();
    setSpeakState("idle");
    setPhase("listening");
    await recorder.start();
    // On failure the hook reports recorder.error, which the effect above
    // turns into an idle phase + typed-input guidance.
  }, [recorder]);

  const handleLanguageChange = useCallback((code: VoiceLanguageCode) => {
    stopSpeaking();
    setSpeakState("idle");
    setLanguage(code);
    try {
      localStorage.setItem(LANGUAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const handlePlayToggle = useCallback(() => {
    if (speakState !== "idle") {
      stopSpeaking();
      setSpeakState("idle");
      return;
    }
    if (!result?.spokenSummary) return;
    speak(result.spokenSummary, language, {
      onState: setSpeakState,
      onFallback: setSpeakFallback,
    });
  }, [speakState, result, language]);

  const handleAutoSpeakChange = useCallback((value: boolean) => {
    setAutoSpeak(value);
    if (!value) {
      stopSpeaking();
      setSpeakState("idle");
    }
  }, []);

  const busy = phase === "transcribing" || phase === "thinking";

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <p className="eyebrow mb-3">Ask OPPY · Voice</p>
        <h1
          className="font-display mb-3"
          style={{
            fontSize: "clamp(1.9rem, 5vw, 2.8rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Just say what you&rsquo;re looking for.
        </h1>
        <p style={{ color: "var(--ink-soft)" }}>
          Speak or type in English, Hindi or Hinglish — OPPY searches its real
          opportunity database and reads the matches back to you.
        </p>
      </div>

      {/* ── Stage: mic + transcript + prompts ────────────────────────── */}
      <VoiceStage
        phase={phase}
        language={language}
        onLanguageChange={handleLanguageChange}
        transcript={transcript}
        onTranscriptChange={setTranscript}
        onRun={(query) => void runQuery(query)}
        onMicToggle={() => void toggleMic()}
        recorderStatus={recorder.status}
        elapsed={recorder.elapsed}
        analyser={recorder.analyser}
        error={error}
        engine={engine}
        prompts={getExamplePrompts(language)}
        busy={busy}
      />

      {/* ── Recent searches ──────────────────────────────────────────── */}
      <RecentSearches
        items={recent}
        onSelect={(query) => {
          setTranscript(query);
          void runQuery(query);
        }}
        onClear={() => {
          setRecent([]);
          try {
            localStorage.removeItem(RECENT_KEY);
          } catch {
            /* ignore */
          }
        }}
      />

      {/* ── Understanding + OPPY says ────────────────────────────────── */}
      {result && (
        <Understanding
          result={result}
          speakState={speakState}
          autoSpeak={autoSpeak}
          onAutoSpeakChange={handleAutoSpeakChange}
          onPlayToggle={handlePlayToggle}
          speakFallback={speakFallback}
        />
      )}

      {/* ── Real OPPY results ────────────────────────────────────────── */}
      {result && <VoiceResults result={result} />}
    </div>
  );
}
