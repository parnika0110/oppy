import { NextResponse } from "next/server";
import { getGnaniEngineStatus } from "@/lib/voice/config";
import type { VoiceStatusResponse } from "@/types/voice";

/**
 * GET /api/voice/status — which engines the voice stack will use right now.
 *
 * Config-only: performs NO external API call and never exposes the key.
 *   stt: "prisma" (live key) | "demo" (GNANI_MOCK) | "unavailable"
 *   tts: "timbre" | "demo"
 */
export async function GET() {
  const response: VoiceStatusResponse = { engine: getGnaniEngineStatus() };
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
