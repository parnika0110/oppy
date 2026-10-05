import { NextRequest, NextResponse } from "next/server";
import { GnaniApiError } from "@/lib/voice/client";
import { isGnaniConfigured } from "@/lib/voice/config";
import { TTS_DEMO_REASON } from "@/lib/voice/mock";
import { synthesizeWithTimbre } from "@/lib/voice/timbre";
import type { TtsJsonResponse } from "@/types/voice";

/**
 * POST /api/tts — Gnani Timbre text-to-speech for the /voice experience.
 *
 * Body: { text: string, language?: string (BCP-47) }
 *
 * Responses:
 *   200 audio/mpeg            — synthesized speech (Gnani key configured)
 *   200 { mode: "demo", … }   — no credential / GNANI_MOCK → client falls back
 *                                to the browser speechSynthesis voice
 *   502 { mode: "error", … }  — Gnani answered with an error
 *   400 { mode: "error", … }  — invalid body
 *
 * The Gnani key is read server-side only and never exposed to the browser.
 */

const MAX_TEXT_LENGTH = 800; // spoken replies are intentionally concise

export async function POST(request: NextRequest) {
  let body: { text?: unknown; language?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<TtsJsonResponse>(
      { mode: "error", message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "en-IN";

  if (!text) {
    return NextResponse.json<TtsJsonResponse>(
      { mode: "error", message: "Nothing to speak." },
      { status: 400 }
    );
  }

  // No live credential (or demo mode) → tell the client to use the browser voice.
  if (!isGnaniConfigured()) {
    return NextResponse.json<TtsJsonResponse>({ mode: "demo", reason: TTS_DEMO_REASON });
  }

  try {
    const result = await synthesizeWithTimbre({
      text: text.slice(0, MAX_TEXT_LENGTH),
      language,
    });
    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    if (err instanceof GnaniApiError) {
      console.error("[TTS] Gnani Timbre error:", err.status, err.type, err.message);
      return NextResponse.json<TtsJsonResponse>(
        { mode: "error", message: err.message },
        { status: 502 }
      );
    }
    console.error("[TTS] Error:", err);
    return NextResponse.json<TtsJsonResponse>(
      { mode: "error", message: "Speech synthesis failed." },
      { status: 500 }
    );
  }
}
