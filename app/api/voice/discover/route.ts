import { NextRequest, NextResponse } from "next/server";
import { getGnaniEngineStatus } from "@/lib/voice/config";
import { discoverVoiceOpportunities } from "@/lib/voice/discover";
import { interpretVoiceQuery } from "@/lib/voice/interpret";
import type { VoiceDiscoverResponse, VoiceLanguageCode } from "@/types/voice";

/**
 * POST /api/voice/discover — voice transcript → OPPY REAL discovery.
 *
 * Body: { query: string, language?: VoiceLanguageCode }
 *
 * Pipeline (all real OPPY data — no mock opportunity catalogue):
 *   1. interpretVoiceQuery   — Sarvam (or mock/local) → structured preferences
 *   2. discoverVoiceOpportunities — MongoDB candidates → lib/relevance ranking
 *   3. grouped results + summary + localized spoken summary for Timbre TTS
 *
 * Never throws: any extraction failure degrades to the local parser.
 */

const MAX_QUERY_LENGTH = 500;

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    let body: { query?: unknown; language?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: "Query is too long." }, { status: 400 });
    }

    const language = (
      typeof body.language === "string" && body.language.trim()
        ? body.language.trim()
        : "en-IN"
    ) as VoiceLanguageCode;

    const interpretation = await interpretVoiceQuery(query, language);
    const discovery = await discoverVoiceOpportunities({
      preferences: interpretation.preferences,
      keywords: interpretation.keywords,
      language,
    });

    const response: VoiceDiscoverResponse = {
      query,
      language,
      preferences: interpretation.preferences,
      signals: interpretation.signals,
      confidence: interpretation.confidence,
      summary: discovery.summary,
      spokenSummary: discovery.spokenSummary,
      groups: discovery.groups,
      total: discovery.total,
      excluded: discovery.excluded,
      browseUrl: discovery.browseUrl,
      interpretSource: interpretation.source,
      engine: getGnaniEngineStatus(),
      tookMs: Date.now() - started,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[Voice/discover] Error:", err);
    return NextResponse.json({ error: "Failed to search opportunities." }, { status: 500 });
  }
}
