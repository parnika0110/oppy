"use client";

/**
 * MediaRecorder + AnalyserNode hook for the /voice page — ported from the
 * Gnani app's useRecorder and adapted to OPPY conventions.
 *
 * Captures one utterance at a time: `start()` opens the mic, `stop()` closes
 * it and resolves with the recorded audio. An `AnalyserNode` is exposed so the
 * mic orb can react to real input level instead of a fake animation.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "listening";

export interface RecorderOptions {
  /** Hard cap so a clip stays inside the STT limit (Gnani accepts ≤60s). */
  maxMs?: number;
  /** Called when the recording stops itself after `maxMs`. */
  onMaxReached?: (blob: Blob) => void;
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/aac",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function friendlyMicError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow the mic in your browser, or type your search below.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone found on this device. You can type your search instead.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Your microphone is busy in another app. Close it and try again.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "Could not start the microphone.";
}

export function useVoiceRecorder(options: RecorderOptions = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const maxMs = options.maxMs ?? 55_000;
  const onMaxReachedRef = useRef(options.onMaxReached);
  onMaxReachedRef.current = options.onMaxReached;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const busyRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (maxTimerRef.current !== null) window.clearTimeout(maxTimerRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    clearTimers();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (contextRef.current && contextRef.current.state !== "closed") {
      void contextRef.current.close().catch(() => undefined);
    }
    contextRef.current = null;
    recorderRef.current = null;
    setAnalyser(null);
  }, [clearTimers]);

  useEffect(() => teardown, [teardown]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      teardown();
      setStatus("idle");
      return null;
    }

    const finished = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" })
            : null;
        chunksRef.current = [];
        resolve(blob);
      };
    });

    try {
      recorder.stop();
    } catch {
      chunksRef.current = [];
    }

    const blob = await finished;
    teardown();
    setStatus("idle");
    setElapsed(0);
    return blob;
  }, [teardown]);

  const start = useCallback(async (): Promise<void> => {
    if (busyRef.current || status === "listening") return;
    busyRef.current = true;
    setError(null);
    setStatus("requesting");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser cannot record audio. Type your search instead.");
      }

      const pendingStream = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      // A permission prompt can sit open indefinitely; never leave the UI
      // stuck on "starting" while we wait for the user to answer it.
      const stream = await Promise.race([
        pendingStream,
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () =>
              reject(
                new Error(
                  "The microphone is taking too long to answer. Check the browser permission and tap again."
                ),
              ),
            12_000,
          );
        }),
      ]).catch((error: unknown) => {
        void pendingStream
          .then((late) => late.getTracks().forEach((track) => track.stop()))
          .catch(() => undefined);
        throw error;
      });
      streamRef.current = stream;

      const ContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const context = ContextCtor ? new ContextCtor() : null;
      if (context) {
        // Never block recording on an autoplay-restricted context.
        if (context.state === "suspended") void context.resume().catch(() => undefined);
        const source = context.createMediaStreamSource(stream);
        const node = context.createAnalyser();
        node.fftSize = 512;
        node.smoothingTimeConstant = 0.75;
        source.connect(node);
        contextRef.current = context;
        setAnalyser(node);
      }

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(200);
      recorderRef.current = recorder;

      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      maxTimerRef.current = window.setTimeout(() => {
        void stop().then((blob) => {
          if (blob) onMaxReachedRef.current?.(blob);
        });
      }, maxMs);

      setStatus("listening");
    } catch (err) {
      teardown();
      setError(friendlyMicError(err));
      setStatus("idle");
    } finally {
      busyRef.current = false;
    }
  }, [maxMs, status, stop, teardown]);

  const clearError = useCallback(() => setError(null), []);

  return { status, error, elapsed, analyser, start, stop, clearError };
}
