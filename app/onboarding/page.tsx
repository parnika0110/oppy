"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

const SUGGESTED_SKILLS = [
  "Python", "JavaScript", "TypeScript", "React", "Node.js", "Java", "C++",
  "Machine Learning", "Data Science", "Web Development", "Mobile Development",
  "DevOps", "UI/UX Design", "SQL", "Go", "Rust", "Swift", "Kotlin",
];

const SUGGESTED_INTERESTS = [
  "AI", "Startups", "Open Source", "Research", "Fintech", "Healthcare",
  "Climate", "Web3", "Robotics", "Game Dev", "Cybersecurity", "Data Engineering",
];

type Step = "welcome" | "interests" | "skills" | "experience" | "location";

const STEPS: Step[] = ["welcome", "interests", "skills", "experience", "location"];
const STEP_TITLES: Record<Step, string> = {
  welcome: "Welcome to OPPY",
  interests: "What are you interested in?",
  skills: "What are your skills?",
  experience: "Your experience level",
  location: "Where are you based?",
};

export default function OnboardingPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);

  // Form state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState("");
  const [experience, setExperience] = useState<string>("");
  const [locations, setLocations] = useState("");
  const [remote, setRemote] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/onboarding");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return <div className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading…</div>;
  }

  const step = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function next() {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    }
  }

  function back() {
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
    }
  }

  async function skip() {
    await completeOnboarding();
  }

  async function finish() {
    await completeOnboarding();
  }

  async function completeOnboarding() {
    setSaving(true);
    try {
      const allInterests = [
        ...selectedInterests,
        ...customInterests.split(",").map((s) => s.trim()).filter(Boolean),
      ];
      const allSkills = [
        ...selectedSkills,
        ...customSkills.split(",").map((s) => s.trim()).filter(Boolean),
      ];
      const allLocations = locations.split(",").map((s) => s.trim()).filter(Boolean);

      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: allInterests,
          skills: allSkills,
          experience: experience || undefined,
          locations: allLocations,
          remote,
          onboardingComplete: true,
        }),
      });

      await refreshUser();
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "70vh" }}>
      {/* Progress bar */}
      <div className="mb-8">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "var(--line)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "var(--lavender-deep)",
            }}
          />
        </div>
        <p
          className="mt-2 text-xs text-right"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--ink-soft)",
          }}
        >
          Step {stepIdx + 1} of {STEPS.length}
        </p>
      </div>

      {/* Step title */}
      <h1
        className="font-display font-semibold tracking-tight mb-6"
        style={{
          fontSize: "clamp(1.5rem, 4vw, 2rem)",
          color: "var(--ink)",
        }}
      >
        {STEP_TITLES[step]}
      </h1>

      {/* Step content */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--card)", border: "1px solid var(--line)" }}
      >
        {step === "welcome" && (
          <div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--ink-soft)" }}>
              Let&apos;s set up your profile so OPPY can recommend the best opportunities for you.
              This takes about 30 seconds and you can change everything later from your profile.
            </p>
            <div className="space-y-3">
              {[
                { icon: "🎯", text: "Get personalized recommendations" },
                { icon: "⏰", text: "Never miss a deadline" },
                { icon: "🌟", text: "Discover opportunities matching your goals" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "var(--paper)" }}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm" style={{ color: "var(--ink)" }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "interests" && (
          <div>
            <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
              Select topics that interest you. We&apos;ll use these to surface relevant opportunities.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {SUGGESTED_INTERESTS.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className="px-3 py-1.5 rounded-full text-xs transition-all"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    border: "1px solid",
                    borderColor: selectedInterests.includes(interest) ? "var(--lavender-deep)" : "var(--line)",
                    background: selectedInterests.includes(interest) ? "var(--lavender)" : "var(--paper)",
                    color: selectedInterests.includes(interest) ? "#4A3F8A" : "var(--ink-soft)",
                  }}
                >
                  {interest}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Custom interests (comma-separated)"
              value={customInterests}
              onChange={(e) => setCustomInterests(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
              }}
            />
          </div>
        )}

        {step === "skills" && (
          <div>
            <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
              What technical skills do you have? We&apos;ll match you with relevant internships and jobs.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {SUGGESTED_SKILLS.map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className="px-3 py-1.5 rounded-full text-xs transition-all"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    border: "1px solid",
                    borderColor: selectedSkills.includes(skill) ? "var(--lavender-deep)" : "var(--line)",
                    background: selectedSkills.includes(skill) ? "var(--lavender)" : "var(--paper)",
                    color: selectedSkills.includes(skill) ? "#4A3F8A" : "var(--ink-soft)",
                  }}
                >
                  {skill}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Custom skills (comma-separated)"
              value={customSkills}
              onChange={(e) => setCustomSkills(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
              }}
            />
          </div>
        )}

        {step === "experience" && (
          <div>
            <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
              This helps us recommend opportunities at the right level for you.
            </p>
            <div className="flex flex-col gap-3">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setExperience(opt)}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-left transition-all"
                  style={{
                    border: "1px solid",
                    borderColor: experience === opt ? "var(--lavender-deep)" : "var(--line)",
                    background: experience === opt ? "var(--lavender)" : "var(--paper)",
                    color: experience === opt ? "#4A3F8A" : "var(--ink)",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {opt === "Beginner" && "🌱 "}
                  {opt === "Intermediate" && "🚀 "}
                  {opt === "Advanced" && "⚡ "}
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "location" && (
          <div>
            <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
              Where are you looking for opportunities? This helps us find location-matching listings.
            </p>
            <input
              type="text"
              placeholder="India, Bengaluru, Remote… (comma-separated)"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm mb-4"
              style={{
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
              }}
            />
            <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
              Remote preference:
            </p>
            <div className="flex gap-3">
              {[
                { label: "Remote OK", value: true },
                { label: "On-site only", value: false },
                { label: "No preference", value: null },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setRemote(opt.value)}
                  className="px-4 py-2 rounded-full text-sm"
                  style={{
                    border: "1px solid var(--line)",
                    background: remote === opt.value ? "var(--ink)" : "var(--paper)",
                    color: remote === opt.value ? "var(--paper)" : "var(--ink)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        {stepIdx > 0 ? (
          <button
            onClick={back}
            className="px-5 py-2.5 rounded-full text-sm font-medium"
            style={{
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--ink)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        <div className="flex gap-3">
          <button
            onClick={skip}
            className="px-5 py-2.5 rounded-full text-sm font-medium"
            style={{
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--ink-soft)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.72rem",
            }}
          >
            Skip for now
          </button>

          {stepIdx < STEPS.length - 1 ? (
            <button
              onClick={next}
              className="px-6 py-2.5 rounded-full text-sm font-medium"
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "'Space Grotesk', sans-serif",
                border: "none",
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="px-6 py-2.5 rounded-full text-sm font-medium"
              style={{
                background: saving ? "var(--ink-soft)" : "var(--lavender-deep)",
                color: "white",
                fontFamily: "'Space Grotesk', sans-serif",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Finish →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
