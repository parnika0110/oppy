import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/sarvam/client";

/**
 * POST /api/ai/transcribe
 *
 * Accepts audio blob and returns transcribed text.
 * Uses Sarvam speech-to-text.
 */
export async function POST(request: NextRequest) {
  try {
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
        { error: "Transcription unavailable. Please type your query instead." },
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
