"use client";

/**
 * Spoken replies for the /voice page — ported from the Gnani app's speech.ts.
 *
 * Primary path: POST /api/tts → Gnani Timbre (server holds the credential).
 * Fallback path: the browser's own speechSynthesis — used in demo mode or
 * whenever Timbre is unavailable — so spoken replies always work offline.
 */

import { getVoiceLanguageOption } from "@/lib/voice/languages";

export interface SpeakHooks {
  onState?: (state: "loading" | "speaking" | "idle") => void;
  /** Set when the reply comes from the browser instead of Gnani Timbre. */
  onFallback?: (reason: string) => void;
  onError?: (message: string) => void;
}

type SynthesizeResult =
  | { kind: "audio"; blob: Blob }
  | { kind: "demo"; reason: string };

/** Ask the server to synthesize `text`; resolves how the answer should play. */
export async function synthesize(text: string, language: string): Promise<SynthesizeResult> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { mode?: string; reason?: string; message?: string }
      | null;
    if (payload?.mode === "demo") {
      return { kind: "demo", reason: payload.reason || "Browser voice in use." };
    }
    throw new Error(
      payload?.message ||
        (response.ok ? "Speech synthesis failed." : "The voice service is unavailable.")
    );
  }
  if (!response.ok) {
    throw new Error("The voice service is unavailable.");
  }
  return { kind: "audio", blob: await response.blob() };
}

let token = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeUrl: string | null = null;

function release(): void {
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeUrl) {
    URL.revokeObjectURL(activeUrl);
    activeUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Stop whatever is speaking right now (safe to call when nothing plays). */
export function stopSpeaking(): void {
  token += 1;
  release();
}

/**
 * Speak `text` in `language` (BCP-47 code from the language selector).
 * Timbre audio when available; browser speechSynthesis otherwise.
 */
export function speak(text: string, language: string, hooks: SpeakHooks = {}): void {
  const myToken = ++token;
  release();
  hooks.onState?.("loading");

  const finish = (state: "idle") => {
    if (myToken === token) hooks.onState?.(state);
  };

  const speakWithBrowser = (fallbackReason?: string) => {
    if (fallbackReason && myToken === token) hooks.onFallback?.(fallbackReason);
    const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!canSpeak) {
      hooks.onError?.("This browser cannot play spoken replies.");
      finish("idle");
      return;
    }
    const option = getVoiceLanguageOption(language);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = option.browserVoice || "en-IN";
    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.onend = () => finish("idle");
    utterance.onerror = () => finish("idle");
    window.speechSynthesis.speak(utterance);
    if (myToken === token) hooks.onState?.("speaking");
  };

  void synthesize(text, language)
    .then((result) => {
      if (myToken !== token) return;

      if (result.kind === "demo") {
        speakWithBrowser(result.reason);
        return;
      }

      const url = URL.createObjectURL(result.blob);
      const audio = new Audio(url);
      activeAudio = audio;
      activeUrl = url;
      audio.onended = () => {
        release();
        finish("idle");
      };
      audio.onerror = () => {
        release();
        hooks.onError?.("The audio could not be played.");
        finish("idle");
      };
      void audio
        .play()
        .then(() => {
          if (myToken === token) hooks.onState?.("speaking");
        })
        .catch(() => {
          release();
          hooks.onError?.("Autoplay was blocked — press play again.");
          finish("idle");
        });
    })
    .catch((error: unknown) => {
      if (myToken !== token) return;
      release();
      // Timbre failed (network/error JSON) → fall back to the browser voice.
      const message = error instanceof Error ? error.message : "Speech synthesis failed.";
      speakWithBrowser(message);
    });
}
