import type { Metadata } from "next";
import { Suspense } from "react";
import VoiceExperience from "@/components/voice/VoiceExperience";

/**
 * /voice — Ask OPPY, the Gnani-powered voice interface.
 *
 * Public route (not middleware-protected). The page itself is a thin server
 * shell: metadata + Suspense, while VoiceExperience owns the client state
 * machine (recorder → /api/stt → /api/voice/discover → /api/tts).
 */

export const metadata: Metadata = {
  title: "Ask OPPY — Voice search",
  description:
    "Speak or type what you're looking for — OPPY searches its real opportunity database in English, Hindi or Hinglish and reads the matches back.",
};

export default function VoicePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto">
          <div
            className="skeleton rounded-2xl mb-6"
            style={{ height: 160, border: "1px solid var(--line)" }}
          />
          <div
            className="skeleton rounded-2xl"
            style={{ height: 260, border: "1px solid var(--line)" }}
          />
        </div>
      }
    >
      <VoiceExperience />
    </Suspense>
  );
}
