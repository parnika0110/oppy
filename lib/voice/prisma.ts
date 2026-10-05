/**
 * Gnani Prisma — Speech to Text (REST), ported from the standalone app.
 *
 * POST {baseUrl}{GNANI_PRISMA_STT_PATH}  (multipart/form-data)
 *   audio_file     : WAV | MP3 | OGG | FLAC | AAC | M4A, <= 60s (ideal <= 30s)
 *   language_code  : BCP-47, e.g. en-IN, hi-IN, ta-IN …
 *   format         : "transcribe" (ITN) | "verbatim"
 * Header: X-API-Key-ID (attached by gnaniRequest)
 *
 * Response: { success, request_id, timestamp, transcript }
 *
 * This REST path is used for the one-shot "stop and transcribe" flow that
 * the /voice page uses (record → upload → transcript).
 */

import { getGnaniConfig } from "@/lib/voice/config";
import { extensionForMimeType, GnaniApiError, gnaniRequest } from "@/lib/voice/client";

export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
  languageCode: string;
}

export interface TranscribeResult {
  transcript: string;
  requestId?: string;
  engine: "prisma";
}

interface PrismaResponse {
  success?: boolean;
  transcript?: string;
  request_id?: string;
  timestamp?: string;
  error?: { type?: string; message?: string };
}

/** Upload one recording to Gnani Prisma and return the transcript. */
export async function transcribeWithPrisma(input: TranscribeInput): Promise<TranscribeResult> {
  const config = getGnaniConfig();

  if (!input.audio || input.audio.length === 0) {
    throw new GnaniApiError(400, "EMPTY_AUDIO", "No audio was captured in the recording.");
  }

  const form = new FormData();
  const bytes = input.audio;
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const extension = extensionForMimeType(input.mimeType);
  form.append(
    "audio_file",
    new Blob([arrayBuffer], { type: input.mimeType || "audio/webm" }),
    `oppy.${extension}`
  );
  form.append("language_code", input.languageCode || config.stt.defaultLanguage);
  form.append("format", config.stt.format);

  const response = await gnaniRequest(config.stt.path, { method: "POST", body: form });
  const payload = (await response.json()) as PrismaResponse;

  if (!payload.success || typeof payload.transcript !== "string") {
    throw new GnaniApiError(
      502,
      payload.error?.type ?? "INVALID_RESPONSE",
      payload.error?.message ?? "Prisma returned no transcript."
    );
  }

  return {
    transcript: payload.transcript.trim(),
    requestId: payload.request_id,
    engine: "prisma",
  };
}
