import { NextRequest, NextResponse } from "next/server";
import { interpretQuery } from "@/lib/sarvam/client";
import { getMockInterpretation } from "@/lib/sarvam/mock";

/**
 * POST /api/ai/interpret
 *
 * Takes a natural language query and returns structured preferences.
 * Uses Sarvam AI for interpretation, or mock fixtures when SARVAM_MOCK=true.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, language } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    // Check for mock mode — preserves Sarvam API credits during development
    const isMockMode = process.env.SARVAM_MOCK === "true";
    let result;

    if (isMockMode) {
      result = getMockInterpretation(message);
      if (!result) {
        return NextResponse.json(
          { error: "No mock fixture found for this query. Try a supported query or disable SARVAM_MOCK." },
          { status: 404 }
        );
      }
    } else {
      result = await interpretQuery(message, language || "en");
    }

    if (!result) {
      return NextResponse.json(
        { error: "AI interpretation unavailable. Try using the filter controls instead." },
        { status: 503 }
      );
    }

    return NextResponse.json({ preferences: result, mock: isMockMode });
  } catch (err) {
    console.error("[AI/interpret] Error:", err);
    return NextResponse.json(
      { error: "Failed to interpret query." },
      { status: 500 }
    );
  }
}
