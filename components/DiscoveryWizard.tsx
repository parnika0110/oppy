"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_OPTIONS = [
  { value: "Job", label: "Jobs", icon: "💼" },
  { value: "Internship", label: "Internships", icon: "🎓" },
  { value: "Hackathon", label: "Hackathons", icon: "⚡" },
  { value: "Fellowship", label: "Fellowships", icon: "🌟" },
  { value: "Event", label: "Events", icon: "📅" },
  { value: "Grant", label: "Grants", icon: "💰" },
  { value: "Scholarship", label: "Scholarships", icon: "🏆" },
];

const INTEREST_OPTIONS = [
  "AI / ML",
  "Web Development",
  "Open Source",
  "Data Science",
  "Design",
  "Research",
  "Cybersecurity",
  "Product Management",
  "Cloud",
  "Startups",
  "Mobile",
  "DevOps",
];

const LOCATION_OPTIONS = [
  { value: "", label: "Anywhere" },
  { value: "Remote", label: "Remote" },
  { value: "India", label: "India" },
  { value: "Global", label: "Global" },
];

const EXPERIENCE_OPTIONS = [
  { value: "Student", label: "Student" },
  { value: "Recent Graduate", label: "Recent graduate" },
  { value: "Working Professional", label: "Working professional" },
];

type Step = "category" | "interests" | "location" | "experience" | "ai";

export default function DiscoveryWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("category");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedExperience, setSelectedExperience] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure no error is visible on initial mount — only show after a real attempt
  useEffect(() => {
    setAiError(null);
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const buildBrowseUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCategories.length > 0) {
      params.set("categories", selectedCategories.join(","));
    }
    if (selectedInterests.length > 0) {
      params.set("interests", selectedInterests.join(","));
    }
    if (selectedLocation === "Remote") {
      params.set("remote", "true");
    } else if (selectedLocation) {
      params.set("location", selectedLocation);
    }
    if (selectedExperience) {
      params.set("experience", selectedExperience);
    }
    params.set("sort", "recommended");
    return `/?${params.toString()}`;
  }, [selectedCategories, selectedInterests, selectedLocation, selectedExperience]);

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/ai/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiQuery }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAiError(data.error || "AI interpretation unavailable");
        setAiLoading(false);
        return;
      }

      const data = await res.json();
      const prefs = data.preferences;

      // Build URL from AI-interpreted preferences
      const params = new URLSearchParams();
      if (prefs.category?.length > 0) {
        params.set("categories", prefs.category.join(","));
      }
      if (prefs.interests?.length > 0) {
        params.set("interests", prefs.interests.join(","));
      }
      if (prefs.remote) {
        params.set("remote", "true");
      }
      if (prefs.location) {
        params.set("location", prefs.location);
      }
      if (prefs.experience) {
        params.set("experience", prefs.experience);
      }
      params.set("sort", "recommended");

      router.push(`/?${params.toString()}`);
    } catch {
      setAiError("Failed to connect to AI service.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    setAiError(null); // Clear any previous error before attempting
    setAiLoading(true); // Disable mic immediately to prevent double-clicks

    if (!navigator.mediaDevices?.getUserMedia) {
      setAiError("Voice input is not supported in this browser. Please type your query.");
      setAiLoading(false);
      return;
    }

    let stream: MediaStream | null = null;
    let mediaRecorder: MediaRecorder | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use the browser's preferred MIME type for best compatibility
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];

      // Capture mimeType before the callback (TypeScript can't prove mediaRecorder is non-null inside onstop)
      const capturedMimeType = mediaRecorder.mimeType || "audio/webm";

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream?.getTracks().forEach((t) => t.stop());

        // If no audio was captured, don't send
        if (chunks.length === 0) {
          setAiError("No audio recorded. Please try again or type your query.");
          setAiLoading(false);
          return;
        }

        const audioBlob = new Blob(chunks, { type: capturedMimeType });

        // aiLoading is already true from handleVoiceInput start
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob);

          const res = await fetch("/api/ai/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (res.ok && data.transcript) {
            setAiQuery(data.transcript);
            setAiError(null); // Clear any stale error on success
          } else if (data.code === "SERVICE_UNAVAILABLE") {
            setAiError("Voice input is not available on this server. Please type your query.");
          } else if (data.code === "TRANSCRIPTION_FAILED") {
            setAiError("Could not understand the audio. Please try again or type instead.");
          } else {
            setAiError(data.error || "Transcription failed. Please type instead.");
          }
        } catch {
          setAiError("Could not connect to the transcription service. Please type your query.");
        } finally {
          setAiLoading(false);
        }
      };

      // Handle recorder errors
      mediaRecorder.onerror = () => {
        stream?.getTracks().forEach((t) => t.stop());
        setAiError("Recording failed. Please try again or type your query.");
        setAiLoading(false);
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 10000); // Max 10 seconds
    } catch (err) {
      // Release microphone if we got it
      stream?.getTracks().forEach((t) => t.stop());

      // Distinguish permission denied from other errors
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setAiError("Microphone permission denied. Please allow microphone access or type your query.");
      } else {
        setAiError("Could not access microphone. Please type your query.");
      }
    }
  };

  const handleGo = () => {
    router.push(buildBrowseUrl());
  };

  // ── Step content ──────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case "category":
        return (
          <div className="dw-step">
            <h3 className="dw-step-title">What are you looking for?</h3>
            <div className="dw-chips">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => toggleCategory(cat.value)}
                  className={`dw-chip ${selectedCategories.includes(cat.value) ? "dw-chip-active" : ""}`}
                  type="button"
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>
            <div className="dw-step-actions">
              <button onClick={() => setStep("interests")} className="dw-btn-next" type="button">
                Next →
              </button>
              <button onClick={handleGo} className="dw-btn-skip" type="button">
                Skip — show all
              </button>
            </div>
          </div>
        );

      case "interests":
        return (
          <div className="dw-step">
            <h3 className="dw-step-title">What are you interested in?</h3>
            <div className="dw-chips">
              {INTEREST_OPTIONS.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`dw-chip ${selectedInterests.includes(interest) ? "dw-chip-active" : ""}`}
                  type="button"
                >
                  {interest}
                </button>
              ))}
            </div>
            <div className="dw-step-actions">
              <button onClick={() => setStep("location")} className="dw-btn-next" type="button">
                Next →
              </button>
              <button onClick={handleGo} className="dw-btn-skip" type="button">
                Skip — show all
              </button>
            </div>
          </div>
        );

      case "location":
        return (
          <div className="dw-step">
            <h3 className="dw-step-title">Where should we look?</h3>
            <div className="dw-chips">
              {LOCATION_OPTIONS.map((loc) => (
                <button
                  key={loc.value}
                  onClick={() => setSelectedLocation(loc.value)}
                  className={`dw-chip ${selectedLocation === loc.value ? "dw-chip-active" : ""}`}
                  type="button"
                >
                  {loc.label}
                </button>
              ))}
            </div>
            <div className="dw-step-actions">
              <button onClick={() => setStep("experience")} className="dw-btn-next" type="button">
                Next →
              </button>
              <button onClick={handleGo} className="dw-btn-skip" type="button">
                Skip — show all
              </button>
            </div>
          </div>
        );

      case "experience":
        return (
          <div className="dw-step">
            <h3 className="dw-step-title">What describes you?</h3>
            <div className="dw-chips">
              {EXPERIENCE_OPTIONS.map((exp) => (
                <button
                  key={exp.value}
                  onClick={() => setSelectedExperience(exp.value)}
                  className={`dw-chip ${selectedExperience === exp.value ? "dw-chip-active" : ""}`}
                  type="button"
                >
                  {exp.label}
                </button>
              ))}
            </div>
            <div className="dw-step-actions">
              <button onClick={handleGo} className="dw-btn-primary" type="button">
                Find my opportunities →
              </button>
              <button onClick={handleGo} className="dw-btn-skip" type="button">
                Show everything
              </button>
            </div>
          </div>
        );
    }
  };

  // ── AI Quick Search ───────────────────────────────────────────────
  const aiSection = (
    <div className="dw-ai-section">
      <div className="dw-ai-row">
        <input
          ref={inputRef}
          type="text"
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAiSearch()}
          placeholder='Try: "I want remote AI internships for students"'
          className="dw-ai-input"
          disabled={aiLoading}
        />
        <button
          onClick={handleVoiceInput}
          className="dw-voice-btn"
          title="Voice input"
          disabled={aiLoading}
          type="button"
        >
          🎤
        </button>
        <button
          onClick={handleAiSearch}
          className="dw-ai-go"
          disabled={aiLoading || !aiQuery.trim()}
          type="button"
        >
          {aiLoading ? "..." : "→"}
        </button>
      </div>
      {aiError && <p className="dw-ai-error">{aiError}</p>}
    </div>
  );

  return (
    <div className="dw-container">
      {aiSection}
      <div className="dw-divider">
        <span>or choose step by step</span>
      </div>
      {renderStep()}
      {/* Step indicators */}
      <div className="dw-steps-indicator">
        {(["category", "interests", "location", "experience"] as Step[]).map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`dw-step-dot ${step === s ? "dw-step-dot-active" : ""}`}
            type="button"
            aria-label={`Step ${i + 1}: ${s}`}
          />
        ))}
      </div>
    </div>
  );
}
