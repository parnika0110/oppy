import { NextRequest, NextResponse } from "next/server";
import { GnaniApiError } from "@/lib/voice/client";
import { isGnaniConfigured, isGnaniMock } from "@/lib/voice/config";
import { getMockTranscript } from "@/lib/voice/mock";
import { transcribeWithPrisma } from "@/lib/voice/prisma";
import type { SttErrorCode, SttResponse } from "@/types/voice";

/**
 * POST /api/stt — Gnani Prisma speech-to-text for the /voice experience.
 *
 * Accepts multipart form data:
 *   audio      — recorded blob (webm/ogg/mp4/wav…)
 *   language   — BCP-47 code (en-IN, hi-IN, hi-en …), optional
 *
 * The Gnani key is read server-side only (lib/voice/config.ts) and is never
 * exposed to the browser. With GNANI_MOCK=true this returns a deterministic
 * demo transcript and performs zero network calls.
 *
 * Error contract (mirrors /api/ai/transcribe so the client can share handling):
 *   503 code=SERVICE_UNAVAILABLE — no credential and no mock mode
 *   503 code=TRANSCRIPTION_FAILED — configured but transcription failed
 *   400 code=EMPTY_AUDIO — no usable audio in the request
 */

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // generous for ≤60s recordings

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const mock = isGnaniMock();
    const configured = isGnaniConfigured();

    if (!mock && !configured) {
      return NextResponse.json(
        {
          error: "Voice input is not available. Please type your query.",
          code: "SERVICE_UNAVAILABLE" satisfies SttErrorCode,
        },
        { status: 503 }
      );
    }

    const formData = await request.formData().catch(() => null);
    const audioFile = formData?.get("audio");
    const audio: File | null = audioFile instanceof File ? audioFile : null;
    const language =
      (typeof formData?.get("language") === "string"
        ? (formData.get("language") as string)
        : null) ||
      request.headers.get("x-oppy-language") ||
      "";
    const mimeType = audio?.type || request.headers.get("x-audio-mime") || "audio/webm";

    // Demo mode: deterministic transcript, no audio needed, zero API calls.
    if (mock) {
      const demo = getMockTranscript(language);
      const response: SttResponse = {
        transcript: demo.transcript,
        engine: "demo",
        requestId: demo.requestId,
        durationMs: Date.now() - started,
      };
      return NextResponse.json(response);
    }

    if (!audio || audio.size === 0) {
      return NextResponse.json(
        { error: "No audio was captured in the recording.", code: "EMPTY_AUDIO" satisfies SttErrorCode },
        { status: 400 }
      );
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Recording is too long — please keep it under a minute.", code: "EMPTY_AUDIO" satisfies SttErrorCode },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const result = await transcribeWithPrisma({
      audio: buffer,
      mimeType,
      languageCode: language,
    });

    if (!result.transcript) {
      return NextResponse.json(
        { error: "Could not understand the audio. Please try again or type instead.", code: "TRANSCRIPTION_FAILED" satisfies SttErrorCode },
        { status: 503 }
      );
    }

    const response: SttResponse = {
      transcript: result.transcript,
      engine: "prisma",
      requestId: result.requestId,
      durationMs: Date.now() - started,
    };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof GnaniApiError) {
      if (err.type === "EMPTY_AUDIO") {
        return NextResponse.json(
          { error: err.message, code: "EMPTY_AUDIO" satisfies SttErrorCode },
          { status: 400 }
        );
      }
      console.error("[STT] Gnani Prisma error:", err.status, err.type, err.message);
      return NextResponse.json(
        { error: "Could not transcribe the audio. Please type instead.", code: "TRANSCRIPTION_FAILED" satisfies SttErrorCode },
        { status: 503 }
      );
    }
    console.error("[STT] Error:", err);
    return NextResponse.json({ error: "Failed to transcribe audio." }, { status: 500 });
  }
}
