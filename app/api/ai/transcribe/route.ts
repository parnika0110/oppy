import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio, isSarvamConfigured } from "@/lib/sarvam/client";

/**
 * POST /api/ai/transcribe
 *
 * Accepts audio blob and returns transcribed text.
 * Uses Sarvam speech-to-text.
 *
 * Returns distinct error codes so the client can differentiate:
 *   - 503 with code "SERVICE_UNAVAILABLE": transcription service not configured
 *   - 503 with code "TRANSCRIPTION_FAILED": service configured but transcription failed
 */
export async function POST(request: NextRequest) {
  try {
    // Fast-fail if the transcription service is not configured at all.
    // This prevents recording audio only to have it rejected.
    if (!isSarvamConfigured()) {
      return NextResponse.json(
        { error: "Voice input is not available. Please type your query.", code: "SERVICE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = formData.get("language") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required." },
        { status: 400 }
      );
    }

    const transcript = await transcribeAudio(audioFile, language || undefined);

    if (!transcript) {
      return NextResponse.json(
        { error: "Could not understand the audio. Please try again or type instead.", code: "TRANSCRIPTION_FAILED" },
        { status: 503 }
      );
    }

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[AI/transcribe] Error:", err);
    return NextResponse.json(
      { error: "Failed to transcribe audio." },
      { status: 500 }
    );
  }
}
