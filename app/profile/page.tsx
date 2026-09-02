"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import {
  SKILL_TAXONOMY,
  INTEREST_TAXONOMY_ENTRIES,
  LOCATION_TAXONOMY,
} from "@/lib/taxonomies";

const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

/**
 * Inline resume upload CTA for the profile page.
 * Uploads directly to /api/resume/upload without going through onboarding.
 */
function ResumeUploadCTA({ user, refreshUser }: { user: any; refreshUser: () => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setSuccess(true);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (success) {
    return (
      <div className="mb-6 p-4 rounded-2xl border border-green-200 bg-green-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-stone-900 text-sm">Resume uploaded</p>
            <p className="text-xs text-stone-500">Your resume has been processed. OPPY will use it to improve your matches.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 rounded-2xl border border-oppy-purple/20 bg-oppy-purple/5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📄</span>
        <div className="flex-1">
          <p className="font-semibold text-stone-900 text-sm">Make OPPY smarter</p>
          <p className="text-xs text-stone-500">Upload your resume to improve your matches</p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <label className="ml-auto px-4 py-2 rounded-xl bg-oppy-purple text-white text-sm font-semibold hover:bg-oppy-purple/90 transition-colors cursor-pointer">
          {uploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser, savedIds } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [experience, setExperience] = useState<string>("");
  const [remote, setRemote] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadedPrefs, setLoadedPrefs] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/profile");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user && !loadedPrefs) {
      setName(user.name);
      // Full preferences aren't in the lightweight AuthContext user object —
      // fetch the full profile once to populate the form.
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((data) => {
          const prefs = data.user?.preferences || {};
          setSkills(prefs.skills || []);
          setInterests(prefs.interests || []);
          setLocations(prefs.locations || []);
          setExperience(prefs.experience || "");
          setRemote(typeof prefs.remote === "boolean" ? prefs.remote : null);
          setLoadedPrefs(true);
        });
    }
  }, [user, loadedPrefs]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          skills,
          interests,
          locations,
          experience: experience || undefined,
          remote,
          onboardingComplete: true,
        }),
      });
      if (res.ok) {
        setSaved(true);
        await refreshUser();
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return <div className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="mb-8">
        <p className="eyebrow mb-2">Your profile</p>
        <h1 className="font-display font-semibold tracking-tight" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)" }}>
          {user.name}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>{user.email}</p>
        <p className="mt-3 text-sm" style={{ color: "var(--ink-soft)" }}>
          {savedIds.size} saved {savedIds.size === 1 ? "opportunity" : "opportunities"}
        </p>
      </div>

      {/* Resume upload CTA */}
      {!(user as any).resumeProfile?.uploaded && (
        <ResumeUploadCTA user={user} refreshUser={refreshUser} />
      )}

      {(user as any).resumeProfile?.uploaded && (
        <div className="mb-6 p-4 rounded-2xl border border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-stone-900 text-sm">Resume uploaded</p>
              <p className="text-xs text-stone-500">
                {((user as any).resumeProfile?.extractedSkills || []).length} skills •
                {" "}{((user as any).resumeProfile?.extractedInterests || []).length} interests detected
              </p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSave}
        style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem", border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}
      >
        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
          />
        </div>

        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Skills</label>
          <SearchableMultiSelect
            entries={SKILL_TAXONOMY}
            selected={skills}
            onChange={setSkills}
            placeholder="Search skills… e.g. Python, React, Machine Learning"
          />
        </div>

        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Interests</label>
          <SearchableMultiSelect
            entries={INTEREST_TAXONOMY_ENTRIES}
            selected={interests}
            onChange={setInterests}
            placeholder="Search interests… e.g. AI, Startups, Open Source"
          />
        </div>

        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Preferred locations</label>
          <SearchableMultiSelect
            entries={LOCATION_TAXONOMY}
            selected={locations}
            onChange={setLocations}
            placeholder="Search locations… e.g. Bengaluru, Remote, Singapore"
          />
        </div>

        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Experience level</label>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
          >
            <option value="">Not set</option>
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Remote preference</label>
          <div className="flex gap-3">
            {[
              { label: "Remote OK", value: true },
              { label: "On-site only", value: false },
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

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "0.875rem",
            background: saving ? "var(--ink-soft)" : "var(--ink)",
            color: "var(--paper)",
            border: "none",
            borderRadius: 10,
            fontSize: "0.9rem",
            fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
