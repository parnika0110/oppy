"use client";

/**
 * Understanding — extracted preference signals, confidence meter and the
 * "OPPY says" spoken-reply panel (play/stop, auto-speak, browser-voice note).
 * Ported from the Gnani app and restyled with OPPY tokens.
 */

import type { VoiceDiscoverResponse } from "@/types/voice";

const SOURCE_LABELS: Record<string, string> = {
  mock: "Demo interpretation",
  sarvam: "AI interpretation",
  local: "Local parser",
};

interface UnderstandingProps {
  result: VoiceDiscoverResponse;
  speakState: "idle" | "loading" | "speaking";
  autoSpeak: boolean;
  onAutoSpeakChange: (value: boolean) => void;
  onPlayToggle: () => void;
  speakFallback: string | null;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High confidence";
  if (confidence >= 0.5) return "Medium confidence";
  return "Low confidence";
}

export default function Understanding({
  result,
  speakState,
  autoSpeak,
  onAutoSpeakChange,
  onPlayToggle,
  speakFallback,
}: UnderstandingProps) {
  const percent = Math.round(result.confidence * 100);

  return (
    <section className="surface p-5 sm:p-6 mt-6" aria-label="What OPPY understood">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* ── What we understood ─────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="eyebrow">What OPPY understood</p>
            <span className="chip" title="How preferences were extracted">
              {SOURCE_LABELS[result.interpretSource] || "Local parser"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {result.signals.length > 0 ? (
              result.signals.map((signal) => (
                <span key={signal.key} className="chip" style={{ background: "var(--paper-2)" }}>
                  <strong style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{signal.label}:</strong>{" "}
                  {signal.value}
                </span>
              ))
            ) : (
              <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
                No structured filters — showing the closest matches.
              </span>
            )}
          </div>

          {/* Confidence meter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
                {confidenceLabel(result.confidence)}
              </span>
              <span className="font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
                {percent}%
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 8, background: "var(--paper-2)", border: "1px solid var(--line)" }}
              role="meter"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Interpretation confidence"
            >
              <div
                className="rounded-full h-full transition-all duration-500"
                style={{
                  width: `${Math.max(4, percent)}%`,
                  background: percent >= 80 ? "#5FA37B" : percent >= 50 ? "var(--accent-deep)" : "#C98A4B",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── OPPY says ──────────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-3">OPPY says</p>
          <blockquote
            className="rounded-xl px-4 py-3 text-sm mb-3"
            style={{
              background: "var(--paper-2)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              lineHeight: 1.55,
            }}
          >
            {result.spokenSummary}
          </blockquote>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onPlayToggle}
              disabled={speakState === "loading"}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-60"
              style={{ background: "var(--accent)", color: "#3A3168", border: "1px solid var(--accent-deep)" }}
            >
              {speakState === "loading"
                ? "Preparing…"
                : speakState === "speaking"
                ? "◼ Stop speaking"
                : "▶ Play reply"}
            </button>

            <label
              className="flex items-center gap-2 text-sm cursor-pointer select-none"
              style={{ color: "var(--ink-soft)" }}
            >
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(event) => onAutoSpeakChange(event.target.checked)}
                style={{ accentColor: "var(--accent-deep)" }}
              />
              Auto-speak replies
            </label>
          </div>

          {speakFallback && (
            <p className="font-mono text-xs mt-2" style={{ color: "var(--ink-soft)" }}>
              {speakFallback}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
