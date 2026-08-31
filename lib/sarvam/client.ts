/**
 * Sarvam AI client for OPPY.
 *
 * Uses Sarvam's API for:
 * - Natural language query interpretation
 * - Speech-to-text transcription
 * - Translation between Indian languages
 *
 * All calls are server-side only. Never expose SARVAM_API_KEY to browser.
 */

const SARVAM_BASE_URL = "https://api.sarvam.ai";

/** Map AI-returned interest names to taxonomy keys. */
const INTEREST_ALIASES: Record<string, string> = {
  "AI": "AI / ML",
  "Artificial Intelligence": "AI / ML",
  "Machine Learning": "AI / ML",
  "ML": "AI / ML",
  "Web Development": "Web Development",
  "Frontend": "Web Development",
  "Backend": "Software Engineering",
  "Full Stack": "Web Development",
  "Software Engineering": "Software Engineering",
  "Open Source": "Open Source",
  "Data Science": "Data Science",
  "Design": "Design",
  "Research": "Research",
  "Cybersecurity": "Cybersecurity",
  "Product Management": "Product Management",
  "Cloud": "Cloud",
  "Startups": "Startups",
  "Mobile": "Mobile",
  "DevOps": "DevOps",
};

function normalizeInterests(raw: string[] | undefined): string[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  const normalized = raw
    .map((i) => INTEREST_ALIASES[i] || i)
    .filter((i) => Boolean(i));
  return normalized.length > 0 ? [...new Set(normalized)] : undefined;
}

interface SarvamConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

function getConfig(): SarvamConfig {
  return {
    apiKey: process.env.SARVAM_API_KEY || undefined,
    baseUrl: SARVAM_BASE_URL,
    timeoutMs: 30000,
  };
}

function isConfigured(): boolean {
  return Boolean(process.env.SARVAM_API_KEY);
}

/**
 * Chat completion — interpret natural language into structured preferences.
 */
export async function interpretQuery(
  userMessage: string,
  language: string = "en"
): Promise<{
  category?: string[];
  interests?: string[];
  remote?: boolean;
  location?: string;
  experience?: string;
  rawResponse?: string;
} | null> {
  if (!isConfigured()) return null;

  const config = getConfig();

  const systemPrompt = `You are OPPY's intelligent query parser. Given a user's natural language request about opportunities (jobs, internships, hackathons, etc.), extract structured preferences.

Return ONLY valid JSON with these fields (all optional):
{
  "category": ["Job", "Internship", "Hackathon", "Fellowship", "Event", "Grant", "Scholarship"],
  "interests": ["AI", "Web Development", "Open Source", "Data Science", "Design", "Research", "Cybersecurity", "Product Management"],
  "remote": true/false/null,
  "location": "Remote" | "India" | "Global" | specific city/country or null,
  "experience": "Student" | "Recent Graduate" | "Working Professional" or null
}

Rules:
- If the user says "remote", set remote=true AND still set the actual location if mentioned
- CRITICAL: remote and location are INDEPENDENT. "remote jobs in India" means remote=true AND location="India"
- Location mappings (CRITICAL — always normalize to English):
  - भारत / bharat → "India"
  - अमेरिका / amerika / यूएसए / USA → "United States"
  - बेंगलुरु / बैंगलोर / bangalore / bengaluru → "Bengaluru"
  - मुंबई / bombay → "Mumbai"
  - दिल्ली / delhi → "Delhi"
  - वैश्विक / global → "Global"
  - दूरस्थ / work from home → set remote=true (but keep location if mentioned)
  - NEVER set location="Remote" — use remote=true instead
- Categories must be from the exact list above
- Interests should be normalized to the list above when possible
  - AI / ML includes: AI, artificial intelligence, machine learning, ML, deep learning, LLM, NLP, data science
  - Software Engineering includes: software, developer, engineer, coding, programming
  - Web Development includes: web, frontend, backend, full stack, React, JavaScript, TypeScript
- If ambiguous, return null for that field
- Do NOT invent opportunities or deadlines
- Respond in the same language as the user if not English`;

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": config.apiKey!,
        "Authorization": `Bearer ${config.apiKey!}`,
      },
      body: JSON.stringify({
        model: "sarvam-105b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(config.timeoutMs!),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("[Sarvam] Chat completion failed:", response.status, errBody.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Post-process: normalize Hindi/translated location names
        let location = typeof parsed.location === "string" ? parsed.location : undefined;
        if (location) {
          const locLower = location.toLowerCase();
          if (["भारत", "bharat"].some(h => locLower.includes(h))) location = "India";
          else if (["अमेरिका", "amerika", "यूएसए"].some(h => locLower.includes(h))) location = "United States";
          else if (["बेंगलुरु", "बैंगलोर"].some(h => locLower.includes(h))) location = "Bengaluru";
          else if (locLower.includes("मुंबई")) location = "Mumbai";
          else if (locLower.includes("दिल्ली")) location = "Delhi";
        }
        // Also scan the original message for Hindi/romanized location names if model missed them
        if (!location) {
          const msgLower = userMessage.toLowerCase();
          if (msgLower.includes("भारत") || msgLower.includes("bharat")) location = "India";
          else if (msgLower.includes("अमेरिका") || msgLower.includes("amerika") || msgLower.includes("usa")) location = "United States";
          else if (msgLower.includes("बेंगलुरु") || msgLower.includes("बैंगलोर") || msgLower.includes("bangalore") || msgLower.includes("bengaluru")) location = "Bengaluru";
          else if (msgLower.includes("मुंबई") || msgLower.includes("mumbai") || msgLower.includes("bombay")) location = "Mumbai";
          else if (msgLower.includes("दिल्ली") || msgLower.includes("delhi")) location = "Delhi";
          else if (msgLower.includes("pune") || msgLower.includes("पुणे")) location = "Pune";
          else if (msgLower.includes("hyderabad") || msgLower.includes("हैदराबाद")) location = "Hyderabad";
          else if (msgLower.includes("chennai") || msgLower.includes("चेन्नई")) location = "Chennai";
        }

        return {
          category: Array.isArray(parsed.category) ? parsed.category : undefined,
          interests: normalizeInterests(parsed.interests),
          remote: typeof parsed.remote === "boolean" ? parsed.remote : undefined,
          location: location || undefined,
          experience: typeof parsed.experience === "string" ? parsed.experience : undefined,
          rawResponse: content,
        };
      } catch {
        // JSON parse failed
      }
    }

    return { rawResponse: content };
  } catch (err) {
    console.error("[Sarvam] Error:", err);
    return null;
  }
}

/**
 * Speech-to-text transcription using Sarvam.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language?: string
): Promise<string | null> {
  if (!isConfigured()) return null;

  const config = getConfig();

  // Diagnostic logging (server-side only, never exposed to client)
  const hasKey = Boolean(config.apiKey);
  const blobSize = audioBlob.size;
  const blobType = audioBlob.type || "unknown";

  try {
    // Normalize MIME type — browser MediaRecorder produces "audio/webm;codecs=opus"
    // but Sarvam only accepts exact types like "audio/webm", not codec-qualified ones
    const normalizedType = (audioBlob.type || "audio/webm").split(";")[0].trim();
    const normalizedBlob = new Blob([audioBlob], { type: normalizedType });

    const formData = new FormData();
    // Sarvam API expects field name "file", not "input"
    formData.append("file", normalizedBlob, "recording.webm");
    // Sarvam API expects "language_code" with BCP-47 values; "unknown" = auto-detect
    formData.append("language_code", language || "unknown");
    // Use current stable model (saaras:v3) — v2.5 is deprecated
    formData.append("model", "saaras:v3");

    console.log(`[Sarvam] STT request: mime=${normalizedType} (original: ${blobType}), size=${blobSize}B, hasKey=${hasKey}`);

    const response = await fetch(`${config.baseUrl}/speech-to-text`, {
      method: "POST",
      headers: {
        "api-subscription-key": config.apiKey!,
      },
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[Sarvam] STT failed: status=${response.status}, body=${errBody.substring(0, 300)}`);
      return null;
    }

    const data = await response.json();
    console.log(`[Sarvam] STT success: transcript length=${(data.transcript || "").length}`);
    return data.transcript || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Sarvam] STT error: ${msg}`);
    return null;
  }
}

/**
 * Translate text using Sarvam.
 */
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string | null> {
  if (!isConfigured()) return null;

  const config = getConfig();

  try {
    const response = await fetch(`${config.baseUrl}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API-Subscription-Key": config.apiKey!,
      },
      body: JSON.stringify({
        input: text,
        source_language_code: sourceLanguage,
        target_language_code: targetLanguage,
        model: "mayura:v1",
        enable_preprocessing: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.translated_text || null;
  } catch (err) {
    console.error("[Sarvam] Translation error:", err);
    return null;
  }
}

/**
 * Detect language of input text.
 */
export async function detectLanguage(
  text: string
): Promise<{ language: string; script: string } | null> {
  if (!isConfigured()) return null;

  const config = getConfig();

  try {
    const response = await fetch(`${config.baseUrl}/language-detection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API-Subscription-Key": config.apiKey!,
      },
      body: JSON.stringify({ input: text }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const lang = data.language_code?.[0];
    return lang
      ? { language: lang.language_code, script: lang.script }
      : null;
  } catch {
    return null;
  }
}

export { isConfigured as isSarvamConfigured };
