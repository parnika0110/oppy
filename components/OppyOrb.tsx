"use client";

import { useId } from "react";

/**
 * OPPY Orb — the canonical product mascot.
 *
 * Always lavender. Only mood/expression changes.
 * Size determines face detail level:
 *   < 20px  → no face (just the orb)
 *   20–32px → eyes only (no mouth)
 *   33px+   → full face (eyes + mouth)
 */

export type OrbMood =
  | "welcoming"   // Default. Gentle smile, centered eyes.
  | "curious"     // Slightly wider eyes, small open mouth.
  | "thinking"    // Half-closed eyes, pupils shifted right, flat mouth.
  | "loading"     // Blinking animation, gentle smile.
  | "success"     // Wide bright eyes, big smile.
  | "excited"     // Raised eyes, wide smile.
  | "no-results"; // Slightly droopy eyes, slight frown.

interface OppyOrbProps {
  mood?: OrbMood;
  size?: number;
  className?: string;
}

export default function OppyOrb({
  mood = "welcoming",
  size = 48,
  className,
}: OppyOrbProps) {
  const uniqueId = useId();
  const gradId = `oppy-grad-${uniqueId}`;
  const r = size / 2;

  // ── Size-based detail level ──────────────────────────────────────
  const showFace = size >= 20;
  const showMouth = size >= 33;

  // ── Expression parameters ────────────────────────────────────────
  const eyeY = mood === "excited" || mood === "success" ? -r * 0.08 : 0;
  const eyeScale = mood === "thinking" ? 0.85 : mood === "no-results" ? 0.92 : mood === "curious" ? 1.05 : 1;
  const eyeDroop = mood === "no-results" ? r * 0.05 : 0;

  // Pupils: "thinking" looks right, "no-results" looks slightly left
  const pupilOffsetX = mood === "thinking" ? r * 0.04 : mood === "no-results" ? -r * 0.02 : 0;

  // Mouth curves — subtle differences
  const mouthD = !showMouth ? null :
    mood === "success"    ? "M -4 4 Q 0 9 4 4" :
    mood === "excited"    ? "M -5 3 Q 0 10 5 3" :
    mood === "curious"    ? "M -2 5 Q 0 7.5 2 5" :
    mood === "no-results" ? "M -3 5.5 Q 0 4 3 5.5" :
    mood === "thinking"   ? "M -3 5.5 L 3 5.5" :
    /* welcoming + loading */ "M -3 5 Q 0 7 3 5";

  const mouthOpacity = mood === "no-results" ? 0.5 : 0.7;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#D2C9EE" />
          <stop offset="100%" stopColor="#8B7DC7" />
        </radialGradient>
      </defs>

      {/* Orb body */}
      <circle cx={r} cy={r} r={r - 1} fill={`url(#${gradId})`} />

      {/* Inner highlight */}
      <circle cx={r * 0.72} cy={r * 0.72} r={r * 0.28} fill="white" opacity="0.12" />

      {/* Face */}
      {showFace && (
        <g transform={`translate(${r}, ${r * 0.88 + eyeY + eyeDroop})`}>
          {/* Eyes */}
          <circle
            cx={-r * 0.2}
            cy={0}
            r={r * 0.1 * eyeScale}
            fill="white"
            opacity={mood === "loading" ? undefined : 0.9}
            className={mood === "loading" ? "oppy-blink" : undefined}
          />
          <circle
            cx={r * 0.2}
            cy={0}
            r={r * 0.1 * eyeScale}
            fill="white"
            opacity={mood === "loading" ? undefined : 0.9}
            className={mood === "loading" ? "oppy-blink" : undefined}
          />

          {/* Pupils (hidden during loading blink) */}
          {mood !== "loading" && (
            <>
              <circle
                cx={-r * 0.2 + pupilOffsetX}
                cy={mood === "thinking" ? 0.5 : 0}
                r={r * 0.045}
                fill="#6B5FB8"
              />
              <circle
                cx={r * 0.2 + pupilOffsetX}
                cy={mood === "thinking" ? 0.5 : 0}
                r={r * 0.045}
                fill="#6B5FB8"
              />
            </>
          )}
        </g>
      )}

      {/* Mouth */}
      {mouthD && (
        <path
          d={mouthD}
          transform={`translate(${r}, ${r * 1.08}) scale(${r / 24})`}
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity={mouthOpacity}
        />
      )}

      {/* Loading blink animation — CSS defined in globals.css */}
      {mood === "loading" && (
        <style>{`
          .oppy-blink {
            animation: oppy-eye-blink 1.2s ease-in-out infinite;
          }
          @keyframes oppy-eye-blink {
            0%, 80%, 100% { opacity: 0.9; }
            85%, 95% { opacity: 0.1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .oppy-blink { animation: none !important; opacity: 0.9; }
          }
        `}</style>
      )}
    </svg>
  );
}
