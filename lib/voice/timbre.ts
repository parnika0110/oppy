/**
 * Gnani Timbre — Text to Speech (REST), ported from the standalone app.
 *
 * POST {baseUrl}{GNANI_TIMBRE_TTS_PATH}  (application/json)
 *   { text, voice, model, language, speed, audio_config }
 * Header: X-API-Key-ID (attached by gnaniRequest)
 *
 * Response: raw binary audio (mp3) in the requested container.
 * Some gateways answer with a JSON error payload even on 200 — treated
 * as a failure below.
 */

import { getGnaniConfig } from "@/lib/voice/config";
import { GnaniApiError, gnaniRequest } from "@/lib/voice/client";

export interface SynthesizeInput {
  text: string;
  language: string;
  voice?: string;
  model?: string;
  speed?: number;
}

export interface SynthesizeResult {
  audio: Buffer;
  contentType: string;
  engine: "timbre";
}

/** Synthesize `text` in `language` and return the raw audio bytes. */
export async function synthesizeWithTimbre(input: SynthesizeInput): Promise<SynthesizeResult> {
  const config = getGnaniConfig();

  const text = input.text.trim();
  if (!text) {
    throw new GnaniApiError(400, "EMPTY_TEXT", "Nothing to speak — the response text is empty.");
  }

  const body = {
    text,
    voice: input.voice || config.tts.voice,
    model: input.model || config.tts.model,
    language: input.language,
    speed: input.speed ?? 1,
    audio_config: {
      sample_rate: 24000,
      num_channels: 1,
      sample_width: 2,
      container: "mp3",
      bitrate: "128k",
    },
  };

  const response = await gnaniRequest(config.tts.path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") ?? "";

  // Error payloads arrive as JSON even with a 200 status on some gateways.
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      success?: boolean;
      error?: { type?: string; message?: string };
    };
    throw new GnaniApiError(
      502,
      payload.error?.type ?? "INVALID_RESPONSE",
      payload.error?.message ?? "Timbre returned no audio."
    );
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    throw new GnaniApiError(502, "EMPTY_AUDIO", "Timbre returned an empty audio payload.");
  }

  return { audio, contentType: contentType || "audio/mpeg", engine: "timbre" };
}
