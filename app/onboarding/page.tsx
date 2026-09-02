"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import OppyOrb from "@/components/OppyOrb";
import type { OrbMood } from "@/components/OppyOrb";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import ResumeUpload from "@/components/ResumeUpload";
import {
  SKILL_TAXONOMY,
  INTEREST_TAXONOMY_ENTRIES,
  LOCATION_TAXONOMY,
  getPopularSkills,
  getPopularInterests,
  getPopularLocations,
} from "@/lib/taxonomies";

/* ── Constants ──────────────────────────────────────────────────────── */

const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

const SUGGESTED_SKILLS = getPopularSkills().map((e) => e.label);

const SUGGESTED_INTERESTS = getPopularInterests().map((e) => e.label);

/**
 * User avatar color options — stored in user.avatar.
 * OPPY itself is always the lavender orb and never changes.
 */
const USER_AVATAR_COLORS = [
  { id: "lavender", name: "Lavender", bg: "#8B7DC7", text: "#FAF6EF" },
  { id: "peach", name: "Peach", bg: "#C98A4B", text: "#FAF6EF" },
  { id: "sage", name: "Sage", bg: "#6E9463", text: "#FAF6EF" },
  { id: "ink", name: "Midnight", bg: "#211D2E", text: "#D2C9EE" },
  { id: "blue", name: "Tide", bg: "#5D8BA3", text: "#FAF6EF" },
  { id: "rose", name: "Rosé", bg: "#B76E79", text: "#FAF6EF" },
];

type UserAvatarColorId = typeof USER_AVATAR_COLORS[number]["id"];

const CATEGORY_OPTIONS = [
  { value: "Internship", icon: "◆", desc: "Real-world experience" },
  { value: "Job", icon: "■", desc: "Full-time positions" },
  { value: "Hackathon", icon: "▲", desc: "Build & compete" },
  { value: "Fellowship", icon: "●", desc: "Deep-dive programs" },
  { value: "Scholarship", icon: "◇", desc: "Funded opportunities" },
  { value: "Event", icon: "○", desc: "Meet & learn" },
  { value: "Grant", icon: "▼", desc: "Fund your project" },
  { value: "Open Source", icon: "⬡", desc: "Contribute & grow" },
];

type Step =
  | "intro"
  | "name"
  | "identity"
  | "method"
  | "interests"
  | "categories"
  | "skills"
  | "experience"
  | "location"
  | "processing"
  | "done";

const JOURNEY_STEPS: Step[] = [
  "intro", "name", "identity", "method", "interests", "categories",
  "skills", "experience", "location",
];

/* OppyOrb imported from @/components/OppyOrb */
/* OrbMood imported from @/components/OppyOrb */

/* ── User Avatar (initials circle) ─────────────────────────────────── */

function UserAvatar({
  name,
  colorId,
  size = 44,
}: {
  name: string;
  colorId?: string;
  size?: number;
}) {
  const color = USER_AVATAR_COLORS.find((c) => c.id === colorId) || USER_AVATAR_COLORS[0];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color.bg,
        color: color.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: size * 0.38,
        fontWeight: 600,
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/* ── OPPY Companion (speech bubble + orb) ───────────────────────────── */

function OppyCompanion({
  message,
  mood = "welcoming",
  size = "normal",
}: {
  message: string;
  mood?: OrbMood;
  size?: "small" | "normal";
}) {
  const [visible, setVisible] = useState(false);
  const [msgVisible, setMsgVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    setMsgVisible(false);
    const t1 = setTimeout(() => setVisible(true), 60);
    const t2 = setTimeout(() => setMsgVisible(true, ), 320);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [message]);

  const orbSize = size === "small" ? 32 : 44;
  const bubbleMaxW = size === "small" ? 200 : 300;

  return (
    <div className="onb-companion">
      <div
        className="onb-companion-orb"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.7)",
        }}
      >
        <OppyOrb mood={mood} size={orbSize} />
      </div>
      <div
        className="onb-companion-bubble"
        style={{
          maxWidth: bubbleMaxW,
          opacity: msgVisible ? 1 : 0,
          transform: msgVisible ? "translateY(0)" : "translateY(6px)",
        }}
      >
        {message}
      </div>
    </div>
  );
}

/* ── Step wrapper with transition ───────────────────────────────────── */

function StepCard({ children, stepKey }: { children: React.ReactNode; stepKey: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const t = setTimeout(() => setShown(true), 40);
    return () => clearTimeout(t);
  }, [stepKey]);

  return (
    <div
      className="onb-step"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(10px)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Chip selector ──────────────────────────────────────────────────── */

function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="onb-chips">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`onb-chip ${active ? "onb-chip-active" : ""}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ── Progress dots ──────────────────────────────────────────────────── */

function ProgressDots({ step }: { step: Step }) {
  const idx = JOURNEY_STEPS.indexOf(step);
  if (idx < 0) return null;
  return (
    <div className="onb-progress" role="progressbar" aria-valuenow={idx + 1} aria-valuemax={JOURNEY_STEPS.length}>
      {JOURNEY_STEPS.map((_, i) => (
        <div
          key={i}
          className={`onb-dot ${i === idx ? "onb-dot-active" : i < idx ? "onb-dot-done" : ""}`}
        />
      ))}
    </div>
  );
}

/* ── Processing step phases ─────────────────────────────────────────── */

const PROCESSING_PHASES = [
  { text: "Scanning opportunity sources…", delay: 0 },
  { text: "Matching with your interests…", delay: 1200 },
  { text: "Filtering by your criteria…", delay: 2400 },
  { text: "Building your opportunity map…", delay: 3600 },
];

/* ── Main onboarding page ───────────────────────────────────────────── */

export default function OnboardingPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("intro");
  const [userName, setUserName] = useState("");
  const [selectedAvatarColor, setSelectedAvatarColor] = useState<UserAvatarColorId | "">("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [remote, setRemote] = useState<boolean | null>(null);
  const [profileMethod, setProfileMethod] = useState<"resume" | "manual" | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingPhase, setProcessingPhase] = useState(0);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/onboarding");
    }
  }, [authLoading, user, router]);

  // Pre-fill from existing profile
  useEffect(() => {
    if (user) {
      if (user.name) setUserName(user.name);
      if (user.avatar) setSelectedAvatarColor(user.avatar as UserAvatarColorId);
      if (user.preferences?.interests?.length) setSelectedInterests(user.preferences.interests);
      if (user.preferences?.skills?.length) setSelectedSkills(user.preferences.skills);
      if (user.preferences?.experience) setExperience(user.preferences.experience);
      if (user.preferences?.locations?.length) setSelectedLocations(user.preferences.locations);
      if (user.preferences?.remote !== undefined) setRemote(user.preferences.remote);
    }
  }, [user]);

  // Focus input on name step
  useEffect(() => {
    if (step === "name") {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [step]);

  // Processing phase progression
  useEffect(() => {
    if (step !== "processing") return;
    const timers = PROCESSING_PHASES.map((phase, i) =>
      setTimeout(() => setProcessingPhase(i), phase.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  if (authLoading || !user) {
    return <div className="text-sm" style={{ color: "var(--ink-soft)", padding: "4rem 2rem", textAlign: "center" }}>Loading…</div>;
  }

  const currentAvatarColor = USER_AVATAR_COLORS.find((c) => c.id === selectedAvatarColor) || USER_AVATAR_COLORS[0];

  const canContinue = (): boolean => {
    switch (step) {
      case "intro": return true;
      case "name": return userName.trim().length > 0;
      case "identity": return selectedAvatarColor.length > 0;
      case "method": return profileMethod !== null;
      case "interests": return selectedInterests.length > 0;
      case "categories": return selectedCategories.length > 0;
      case "skills": return selectedSkills.length > 0;
      case "experience": return true;
      case "location": return true;
      default: return true;
    }
  };

  function toggleInterest(v: string) {
    setSelectedInterests((p) => p.includes(v) ? p.filter((i) => i !== v) : [...p, v]);
  }
  function addInterest(v: string) {
    if (!selectedInterests.includes(v)) setSelectedInterests((p) => [...p, v]);
  }
  function toggleSkill(v: string) {
    setSelectedSkills((p) => p.includes(v) ? p.filter((s) => s !== v) : [...p, v]);
  }
  function addSkill(v: string) {
    if (!selectedSkills.includes(v)) setSelectedSkills((p) => [...p, v]);
  }
  function toggleCategory(v: string) {
    setSelectedCategories((p) => p.includes(v) ? p.filter((c) => c !== v) : [...p, v]);
  }

  function goNext() {
    const idx = JOURNEY_STEPS.indexOf(step);
    if (idx < JOURNEY_STEPS.length - 1) {
      let nextIdx = idx + 1;
      // When coming from resume path, skip interests and skills steps
      // since the user already chose those in the ResumeUpload confirmation.
      // Do NOT skip categories — a resume cannot determine what types of
      // opportunities the user is looking for.
      if (profileMethod === "resume" && step === "method") {
        // Skip interests and skills → go to categories
        while (
          nextIdx < JOURNEY_STEPS.length &&
          ["interests", "skills"].includes(JOURNEY_STEPS[nextIdx])
        ) {
          nextIdx++;
        }
      }
      setStep(JOURNEY_STEPS[nextIdx]);
    }
  }

  function goBack() {
    const idx = JOURNEY_STEPS.indexOf(step);
    if (idx > 0) {
      let prevIdx = idx - 1;
      // When on resume path, skip back over interests/skills
      // since those were handled by the ResumeUpload confirmation.
      if (profileMethod === "resume") {
        while (prevIdx > 0 && ["interests", "skills"].includes(JOURNEY_STEPS[prevIdx])) {
          prevIdx--;
        }
      }
      setStep(JOURNEY_STEPS[prevIdx]);
    }
  }

  function skip() {
    // Save whatever preferences were already entered, but do NOT mark onboarding as complete
    saveAndRedirect(false);
  }

  async function handleContinue() {
    if (step === "intro" || step === "name" || step === "identity") {
      await new Promise((r) => setTimeout(r, 400));
    }
    goNext();
  }

  async function handleFinish() {
    setStep("processing");
    await saveAndRedirect(true);
  }

  async function saveAndRedirect(complete: boolean) {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName.trim() || user?.name || "",
          avatar: selectedAvatarColor || undefined,
          interests: selectedInterests,
          skills: selectedSkills,
          experience: experience || undefined,
          categories: selectedCategories,
          locations: selectedLocations,
          remote,
          onboardingComplete: complete,
        }),
      });

      await refreshUser();

      if (complete) {
        await new Promise((r) => setTimeout(r, 4500));
      }
      setStep("done");
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  const firstName = userName.split(" ")[0] || "friend";

  /* ── Render helpers ────────────────────────────────────────────────── */

  function renderIntro() {
    return (
      <StepCard stepKey="intro">
        <div className="onb-intro-orb-wrap">
          <div className="onb-intro-orb-glow" />
          <OppyOrb mood="welcoming" size={80} />
        </div>
        <h1 className="onb-intro-title">Hey, I&apos;m OPPY.</h1>
        <p className="onb-intro-sub">
          Your personal opportunity sidekick. I&apos;ll help you find
          internships, hackathons, fellowships, and more — tailored just for you.
        </p>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button onClick={handleContinue} className="onb-btn-primary">
            Let&apos;s get started →
          </button>
          <button onClick={skip} className="onb-btn-skip" style={{ fontSize: "0.8rem" }}>
            Skip for now — browse without preferences
          </button>
        </div>
      </StepCard>
    );
  }

  function renderName() {
    return (
      <StepCard stepKey="name">
        <OppyCompanion
          message={`Nice to meet you! What should I call you?`}
          mood="welcoming"
        />
        <div className="onb-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) handleContinue(); }}
            placeholder="Your first name"
            className="onb-input"
            maxLength={30}
          />
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <button onClick={handleContinue} className="onb-btn-primary" disabled={!canContinue()}>
            Continue →
          </button>
        </div>
      </StepCard>
    );
  }

  function renderIdentity() {
    return (
      <StepCard stepKey="identity">
        <OppyCompanion
          message={
            userName
              ? `${userName.split(" ")[0]}, pick your look. This is how you'll appear on OPPY.`
              : "Pick your look. This is how you'll appear on OPPY."
          }
          mood="excited"
        />
        <div className="onb-identity-grid">
          {USER_AVATAR_COLORS.map((av) => {
            const active = selectedAvatarColor === av.id;
            return (
              <button
                key={av.id}
                type="button"
                onClick={() => setSelectedAvatarColor(av.id)}
                className={`onb-identity-btn ${active ? "onb-identity-active" : ""}`}
                aria-label={`Choose ${av.name} avatar`}
              >
                <div className="onb-identity-orb">
                  <UserAvatar name={userName || "U"} colorId={av.id} size={44} />
                </div>
                <span className="onb-identity-name">{av.name}</span>
              </button>
            );
          })}
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <button onClick={handleContinue} className="onb-btn-primary" disabled={!canContinue()}>
            Continue →
          </button>
        </div>
      </StepCard>
    );
  }

  function renderMethod() {
    if (profileMethod === "resume") {
      return (
        <StepCard stepKey="method">
          <OppyCompanion
            message="Upload your resume and OPPY will extract your skills, projects, and experience."
            mood="excited"
          />
          <ResumeUpload
            onConfirm={(skills, interests) => {
              setSelectedSkills(skills);
              setSelectedInterests(interests);
              goNext();
            }}
            onSkip={() => {
              setProfileMethod(null);
            }}
          />
          <div className="onb-nav">
            <button onClick={goBack} className="onb-btn-back">← Back</button>
          </div>
        </StepCard>
      );
    }

    return (
      <StepCard stepKey="method">
        <OppyCompanion
          message="How would you like to build your profile?"
          mood="welcoming"
        />
        <div className="flex flex-col gap-4 mt-4">
          <button
            onClick={() => setProfileMethod("resume")}
            className="w-full text-left p-5 rounded-2xl border-2 border-stone-200 hover:border-oppy-purple/50 hover:bg-oppy-purple/5 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-semibold text-stone-900">Upload my resume</p>
                <p className="text-sm text-stone-500">OPPY will extract your skills, projects & experience</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setProfileMethod("manual")}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
              profileMethod === "manual"
                ? "border-oppy-purple bg-oppy-purple/5 ring-2 ring-oppy-purple/20"
                : "border-stone-200 hover:border-oppy-purple/50 hover:bg-oppy-purple/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✍️</span>
              <div>
                <p className="font-semibold text-stone-900">Build it myself</p>
                <p className="text-sm text-stone-500">Choose your skills and interests manually</p>
              </div>
            </div>
          </button>
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <button onClick={handleContinue} className="onb-btn-primary" disabled={!canContinue()}>
            Continue →
          </button>
        </div>
      </StepCard>
    );
  }

  function renderInterests() {
    return (
      <StepCard stepKey="interests">
        <OppyCompanion
          message="Tell me what you're into. I'll find opportunities that match."
          mood="welcoming"
        />
        <div className="onb-body">
          <ChipGrid options={SUGGESTED_INTERESTS} selected={selectedInterests} onToggle={toggleInterest} />
          <div style={{ marginTop: 12 }}>
            <SearchableMultiSelect
              entries={INTEREST_TAXONOMY_ENTRIES}
              selected={selectedInterests}
              onChange={setSelectedInterests}
              placeholder="Search interests… e.g. Data Engineering, NLP"
              popularLabel="More interests"
            />
          </div>
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <div className="onb-nav-right">
            <button onClick={skip} className="onb-btn-skip">Skip</button>
            <button onClick={handleContinue} className="onb-btn-primary" disabled={!canContinue()}>
              Continue →
            </button>
          </div>
        </div>
      </StepCard>
    );
  }

  function renderCategories() {
    return (
      <StepCard stepKey="categories">
        <OppyCompanion
          message="What kind of opportunities should I find for you?"
          mood="thinking"
        />
        <div className="onb-cat-grid">
          {CATEGORY_OPTIONS.map((cat) => {
            const active = selectedCategories.includes(cat.value);
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggleCategory(cat.value)}
                className={`onb-cat-btn ${active ? "onb-cat-active" : ""}`}
              >
                <span className="onb-cat-icon">{cat.icon}</span>
                <div className="onb-cat-text">
                  <span className="onb-cat-name">{cat.value}</span>
                  <span className="onb-cat-desc">{cat.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <div className="onb-nav-right">
            <button onClick={skip} className="onb-btn-skip">Skip</button>
            <button onClick={handleContinue} className="onb-btn-primary" disabled={!canContinue()}>
              Continue →
            </button>
          </div>
        </div>
      </StepCard>
    );
  }

  function renderSkills() {
    return (
      <StepCard stepKey="skills">
        <OppyCompanion
          message="What can you do? Your skills help me match you with the right roles."
          mood="welcoming"
        />
        <div className="onb-body">
          <ChipGrid options={SUGGESTED_SKILLS} selected={selectedSkills} onToggle={toggleSkill} />
          <div style={{ marginTop: 12 }}>
            <SearchableMultiSelect
              entries={SKILL_TAXONOMY}
              selected={selectedSkills}
              onChange={setSelectedSkills}
              placeholder="Search skills… e.g. PyTorch, Terraform, Figma"
              popularLabel="More skills"
            />
          </div>
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <div className="onb-nav-right">
            <button onClick={skip} className="onb-btn-skip">Skip</button>
            <button onClick={handleContinue} className="onb-btn-primary" disabled={!canContinue()}>
              Continue →
            </button>
          </div>
        </div>
      </StepCard>
    );
  }

  function renderExperience() {
    return (
      <StepCard stepKey="experience">
        <OppyCompanion
          message="What's your experience level? This helps me recommend opportunities at the right level."
          mood="welcoming"
        />
        <div className="onb-exp-grid">
          {EXPERIENCE_OPTIONS.map((opt) => {
            const active = experience === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setExperience(opt)}
                className={`onb-exp-btn ${active ? "onb-exp-active" : ""}`}
              >
                <span className="onb-exp-dot" style={{
                  background: active ? "var(--accent-deep)" : "var(--line)",
                }} />
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <div className="onb-nav-right">
            <button onClick={skip} className="onb-btn-skip">Skip</button>
            <button onClick={handleContinue} className="onb-btn-primary">
              Continue →
            </button>
          </div>
        </div>
      </StepCard>
    );
  }

  function renderLocation() {
    return (
      <StepCard stepKey="location">
        <OppyCompanion
          message="Almost there. Where are you looking for opportunities?"
          mood="excited"
        />
        <div className="onb-body">
          <SearchableMultiSelect
            entries={LOCATION_TAXONOMY}
            selected={selectedLocations}
            onChange={setSelectedLocations}
            placeholder="Search locations… e.g. Bengaluru, Remote, Singapore"
            popularLabel="Popular locations"
          />
          <div className="onb-remote-section">
            <p className="onb-remote-label">Remote preference</p>
            <div className="onb-remote-row">
              {[
                { label: "Remote OK", value: true },
                { label: "On-site only", value: false },
                { label: "No preference", value: null },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setRemote(opt.value)}
                  className={`onb-remote-btn ${remote === opt.value ? "onb-remote-active" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="onb-nav">
          <button onClick={goBack} className="onb-btn-back">← Back</button>
          <button onClick={handleFinish} className="onb-btn-finish" disabled={saving}>
            {saving ? "Saving…" : "Find my opportunities →"}
          </button>
        </div>
      </StepCard>
    );
  }

  function renderProcessing() {
    return (
      <StepCard stepKey="processing">
        <div className="onb-processing">
          {/* OPPY orb in center with glow */}
          <div className="onb-processing-orb-wrap">
            <div className="onb-processing-glow" />
            <OppyOrb mood="thinking" size={72} />
          </div>

          {/* Phase text */}
          <p className="onb-processing-text">
            {processingPhase >= 3
              ? `Got it, ${firstName}. Your opportunity map is ready.`
              : `Got it, ${firstName}. ${PROCESSING_PHASES[Math.min(processingPhase, PROCESSING_PHASES.length - 1)].text}`
            }
          </p>

          {/* Constellation-like signal dots */}
          <div className="onb-processing-signals">
            {selectedInterests.slice(0, 3).map((interest, i) => (
              <span key={interest} className="onb-signal-dot" style={{ animationDelay: `${i * 0.4}s` }}>
                {interest}
              </span>
            ))}
            {selectedSkills.slice(0, 2).map((skill, i) => (
              <span key={skill} className="onb-signal-dot onb-signal-secondary" style={{ animationDelay: `${(i + 3) * 0.4}s` }}>
                {skill}
              </span>
            ))}
          </div>

          {/* Subtle progress bar */}
          <div className="onb-processing-bar-track">
            <div
              className="onb-processing-bar-fill"
              style={{
                width: `${((processingPhase + 1) / PROCESSING_PHASES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </StepCard>
    );
  }

  /* ── Main render ───────────────────────────────────────────────────── */

  const isJourney = JOURNEY_STEPS.includes(step);

  return (
    <div className="onb-container">
      {isJourney && <ProgressDots step={step} />}

      <div className="onb-content">
        {step === "intro" && renderIntro()}
        {step === "name" && renderName()}
        {step === "identity" && renderIdentity()}
        {step === "method" && renderMethod()}
        {step === "interests" && renderInterests()}
        {step === "categories" && renderCategories()}
        {step === "skills" && renderSkills()}
        {step === "experience" && renderExperience()}
        {step === "location" && renderLocation()}
        {step === "processing" && renderProcessing()}
      </div>
    </div>
  );
}
