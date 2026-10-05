"use client";

/**
 * VoiceStage — microphone orb with real input-level animation, recording
 * timer, editable transcript (typed fallback) and language selector.
 * Restyled from the Gnani app's VoiceStage using OPPY design tokens.
 */

import { useEffect, useRef } from "react";
import { VOICE_LANGUAGES } from "@/lib/voice/languages";
import type { VoiceEngineStatus, VoiceLanguageCode } from "@/types/voice";
import type { VoicePhase } from "./VoiceExperience";

interface VoiceStageProps {
  phase: VoicePhase;
  language: VoiceLanguageCode;
  onLanguageChange: (code: VoiceLanguageCode) => void;
  transcript: string;
  onTranscriptChange: (value: string) => void;
  /** Run a search with an explicit query (prompt chips) or the current transcript (form). */
  onRun: (query: string) => void;
  onMicToggle: () => void;
  recorderStatus: "idle" | "requesting" | "listening";
  elapsed: number;
  analyser: AnalyserNode | null;
  error: string | null;
  engine: VoiceEngineStatus | null;
  prompts: string[];
  busy: boolean;
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function MicGlyph({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The mic button: real analyser level scales the inner disc while listening. */
function MicOrb({
  listening,
  busy,
  requesting,
  analyser,
  onClick,
}: {
  listening: boolean;
  busy: boolean;
  requesting: boolean;
  analyser: AnalyserNode | null;
  onClick: () => void;
}) {
  const levelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!listening || !analyser) return;
    let frame = 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const value = (data[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / data.length);
      const scale = 1 + Math.min(rms * 2.6, 0.55);
      if (levelRef.current) {
        levelRef.current.style.transform = `scale(${scale.toFixed(3)})`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [listening, analyser]);

  useEffect(() => {
    if (!listening && levelRef.current) levelRef.current.style.transform = "scale(1)";
  }, [listening]);

  const background = listening ? "var(--accent-deep)" : "var(--card)";
  const border = listening ? "2px solid var(--accent-deep)" : "1.5px solid var(--line)";
  const iconColor = listening ? "var(--paper)" : "var(--ink)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 96, height: 96 }}>
      {listening && (
        <span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            inset: 0,
            border: "2px solid var(--accent-deep)",
            opacity: 0.45,
            animation: "oppy-voice-ping 1.6s ease-out infinite",
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label={listening ? "Stop recording" : "Start voice search"}
        className="relative inline-flex items-center justify-center rounded-full cursor-pointer transition-all duration-200"
        style={{
          width: 96,
          height: 96,
          background,
          border,
          boxShadow: listening
            ? "0 12px 30px -14px rgba(139,125,199,0.65)"
            : "0 10px 24px -18px rgba(33,29,46,0.5)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <span
          ref={levelRef}
          className="inline-flex items-center justify-center transition-transform duration-75"
          style={{ willChange: "transform" }}
        >
          {busy || requesting ? (
            <span
              className="inline-block rounded-full animate-spin"
              style={{
                width: 26,
                height: 26,
                border: "3px solid var(--line)",
                borderTopColor: listening ? "var(--paper)" : "var(--ink)",
              }}
            />
          ) : (
            <MicGlyph color={iconColor} />
          )}
        </span>
      </button>
    </div>
  );
}

export default function VoiceStage({
  phase,
  language,
  onLanguageChange,
  transcript,
  onTranscriptChange,
  onRun,
  onMicToggle,
  recorderStatus,
  elapsed,
  analyser,
  error,
  engine,
  prompts,
  busy,
}: VoiceStageProps) {
  const listening = recorderStatus === "listening" || phase === "listening";

  const statusText = (() => {
    if (phase === "transcribing") return "Transcribing your words…";
    if (phase === "thinking") return "Searching OPPY…";
    if (listening) return `Listening… ${formatElapsed(elapsed)} — tap to stop`;
    if (recorderStatus === "requesting") return "Starting the microphone…";
    if (phase === "done") return "Ask another question below.";
    return "Tap the mic or type your search below.";
  })();

  const engineBadge = (() => {
    if (!engine) return null;
    if (engine.ready) return "Prisma STT · Timbre TTS";
    if (engine.stt === "demo") return "Demo voice mode";
    return "Typed search mode";
  })();

  return (
    <section className="surface p-5 sm:p-7" aria-label="Voice search">
      {/* Language selector + engine badge */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          <span className="eyebrow">Language</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as VoiceLanguageCode)}
            className="chip cursor-pointer"
            style={{ padding: "0.35rem 0.7rem" }}
            aria-label="Voice language"
          >
            {VOICE_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label} — {option.native}
              </option>
            ))}
          </select>
        </label>
        {engineBadge && (
          <span
            className="chip"
            style={{
              background: engine?.ready ? "#E4F0E8" : "var(--paper-2)",
              color: engine?.ready ? "#1F5A3A" : "var(--ink-soft)",
            }}
          >
            {engineBadge}
          </span>
        )}
      </div>

      {/* Mic + status */}
      <div className="flex flex-col items-center text-center gap-4">
        <MicOrb
          listening={listening}
          busy={busy}
          requesting={recorderStatus === "requesting"}
          analyser={analyser}
          onClick={onMicToggle}
        />
        <p
          className="font-mono text-sm"
          style={{ color: listening ? "var(--accent-deep)" : "var(--ink-soft)" }}
          aria-live="polite"
        >
          {statusText}
        </p>
      </div>

      {/* Typed fallback — always available, no microphone required */}
      <form
        className="mt-5 flex flex-col sm:flex-row gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (transcript.trim()) onRun(transcript);
        }}
      >
        <textarea
          value={transcript}
          onChange={(event) => onTranscriptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (transcript.trim()) onRun(transcript);
            }
          }}
          rows={2}
          placeholder='Try “remote AI internships for students in India”'
          aria-label="Type your search"
          className="flex-1 resize-y rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--paper-2)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={busy || !transcript.trim()}
          className="rounded-xl px-6 py-3 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{ background: "var(--ink)", color: "var(--paper)", alignSelf: "stretch" }}
        >
          {busy ? "Working…" : "Search"}
        </button>
      </form>

      {/* Mic / request errors */}
      {error && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          role="alert"
          style={{ background: "#FDECEC", border: "1px solid #F3C6C6", color: "#7A2E2E" }}
        >
          {error}
        </div>
      )}

      {/* Language-specific example prompts */}
      {!busy && (
        <div className="mt-5">
          <p className="eyebrow mb-2">Try saying</p>
          <div className="flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chip cursor-pointer hover:border-[var(--accent-deep)] transition-colors"
                onClick={() => {
                  onTranscriptChange(prompt);
                  onRun(prompt);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
