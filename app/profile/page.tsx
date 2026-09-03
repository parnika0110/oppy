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

// ── Resume Management Section ──────────────────────────────────────────

function ResumeSection({ user, refreshUser }: { user: any; refreshUser: () => Promise<void> }) {
  const rp = user?.resumeProfile;
  const hasResume = rp?.uploaded;

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showInsights, setShowInsights] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/resume/remove", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      await refreshUser();
      setConfirmRemove(false);
    } catch {
      setError("Failed to remove resume.");
    } finally {
      setRemoving(false);
    }
  }

  // ── No resume uploaded yet ─────────────────────────────────────────
  if (!hasResume) {
    return <UploadCTA user={user} refreshUser={refreshUser} />;
  }

  // ── Resume exists ──────────────────────────────────────────────────
  const skillCount = (rp.extractedSkills || []).length;
  const interestCount = (rp.extractedInterests || []).length;
  const projectCount = (rp.projects || []).length;
  const experienceCount = (rp.experience || []).length;

  return (
    <div className="mb-6">
      {/* Status banner */}
      <div className="p-4 rounded-2xl border border-green-200 bg-green-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-900 text-sm">Resume uploaded</p>
            <p className="text-xs text-stone-500">
              {skillCount} skills · {interestCount} interests detected
              {projectCount > 0 && ` · ${projectCount} projects`}
              {experienceCount > 0 && ` · ${experienceCount} experience`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => setShowInsights(!showInsights)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-oppy-purple/30 bg-white hover:bg-oppy-purple/5 transition-colors cursor-pointer"
            style={{ color: "var(--accent-deep)" }}
          >
            {showInsights ? "Hide insights" : "View extracted insights"}
          </button>

          <label className="px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 bg-white hover:bg-stone-50 transition-colors cursor-pointer">
            {uploading ? "Replacing…" : "Replace resume"}
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleReplace}
              className="hidden"
              disabled={uploading}
            />
          </label>

          {!confirmRemove ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 bg-white hover:bg-red-50 transition-colors cursor-pointer text-red-600"
            >
              Remove resume
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Remove resume data?</span>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                {removing ? "Removing…" : "Yes, remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 bg-white hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {/* Expandable extracted insights */}
      {showInsights && (
        <ResumeInsightsPanel profile={rp} user={user} refreshUser={refreshUser} />
      )}
    </div>
  );
}

// ── Upload CTA (no resume yet) ────────────────────────────────────────

function UploadCTA({ user, refreshUser }: { user: any; refreshUser: () => Promise<void> }) {
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
      const res = await fetch("/api/resume/upload", { method: "POST", body: formData });
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
            <p className="text-xs text-stone-500">Your resume has been processed.</p>
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
          <input type="file" accept=".pdf,.docx,.doc" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

// ── Extracted Insights Panel ───────────────────────────────────────────

function ResumeInsightsPanel({
  profile,
  user,
  refreshUser,
}: {
  profile: any;
  user: any;
  refreshUser: () => Promise<void>;
}) {
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const [addingInterest, setAddingInterest] = useState<string | null>(null);

  const currentSkills: string[] = user?.preferences?.skills || [];
  const currentInterests: string[] = user?.preferences?.interests || [];
  const resumeSkills: string[] = profile?.extractedSkills || [];
  const resumeInterests: string[] = profile?.extractedInterests || [];

  async function addSkillToPreferences(skill: string) {
    if (currentSkills.includes(skill)) return;
    setAddingSkill(skill);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: [...currentSkills, skill] }),
      });
      await refreshUser();
    } finally {
      setAddingSkill(null);
    }
  }

  async function addInterestToPreferences(interest: string) {
    if (currentInterests.includes(interest)) return;
    setAddingInterest(interest);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: [...currentInterests, interest] }),
      });
      await refreshUser();
    } finally {
      setAddingInterest(null);
    }
  }

  return (
    <div className="mt-3 p-4 rounded-2xl border border-stone-200 bg-white">
      <p className="text-xs text-stone-400 mb-3 italic">
        These signals help OPPY personalize your recommendations. They don&apos;t change your preferences unless you add them.
      </p>

      {/* Resume Skills */}
      {resumeSkills.length > 0 && (
        <div className="mb-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-stone-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Skills found
          </p>
          <div className="flex flex-wrap gap-1.5">
            {resumeSkills.map((skill) => {
              const alreadyAdded = currentSkills.includes(skill);
              return (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border"
                  style={{
                    background: alreadyAdded ? "var(--accent)" : "var(--paper)",
                    borderColor: alreadyAdded ? "var(--accent-deep)" : "var(--line)",
                    color: alreadyAdded ? "var(--accent-deep)" : "var(--ink-soft)",
                  }}
                >
                  {skill}
                  {alreadyAdded ? (
                    <span className="text-[0.6rem] opacity-60">✓</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addSkillToPreferences(skill)}
                      disabled={addingSkill === skill}
                      className="text-[0.6rem] font-semibold opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-none p-0"
                      style={{ color: "var(--accent-deep)" }}
                    >
                      {addingSkill === skill ? "…" : "+"}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Resume Interests */}
      {resumeInterests.length > 0 && (
        <div className="mb-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-stone-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Interests found
          </p>
          <div className="flex flex-wrap gap-1.5">
            {resumeInterests.map((interest) => {
              const alreadyAdded = currentInterests.includes(interest);
              return (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border"
                  style={{
                    background: alreadyAdded ? "var(--accent)" : "var(--paper)",
                    borderColor: alreadyAdded ? "var(--accent-deep)" : "var(--line)",
                    color: alreadyAdded ? "var(--accent-deep)" : "var(--ink-soft)",
                  }}
                >
                  {interest}
                  {alreadyAdded ? (
                    <span className="text-[0.6rem] opacity-60">✓</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addInterestToPreferences(interest)}
                      disabled={addingInterest === interest}
                      className="text-[0.6rem] font-semibold opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-none p-0"
                      style={{ color: "var(--accent-deep)" }}
                    >
                      {addingInterest === interest ? "…" : "+"}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Resume projects/experience summary */}
      {(profile.projects?.length > 0 || profile.experience?.length > 0) && (
        <div className="pt-3 border-t border-stone-100">
          <div className="flex gap-4 text-xs text-stone-400">
            {profile.projects?.length > 0 && (
              <span>{profile.projects.length} projects detected</span>
            )}
            {profile.experience?.length > 0 && (
              <span>{profile.experience.length} experience entries</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Delete Account Section ─────────────────────────────────────────────

function DeleteAccountSection({ user, router }: { user: any; router: any }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText === "DELETE";

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deletion failed");
      // Session cleared by server — redirect
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-12 pt-8 border-t border-red-200">
      <p className="eyebrow mb-2" style={{ color: "#991B1B" }}>Danger zone</p>
      <h3 className="font-display font-semibold text-sm mb-1" style={{ color: "#991B1B" }}>
        Delete account
      </h3>
      <p className="text-xs text-stone-500 mb-4 max-w-md">
        This will permanently delete your account, saved opportunities, resume data, and all preferences.
        This action cannot be undone.
      </p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-red-300 text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer"
        >
          Delete account
        </button>
      ) : (
        <div className="p-4 rounded-xl border border-red-300 bg-red-50">
          <p className="text-xs text-red-700 mb-3">
            Type <strong>DELETE</strong> to confirm permanent account deletion:
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full max-w-xs px-3 py-2 rounded-lg text-sm border border-red-300 bg-white mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button
              type="button"
              onClick={() => { setShowConfirm(false); setConfirmText(""); setError(""); }}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-stone-200 bg-white hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main Profile Page ──────────────────────────────────────────────────

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

      {/* Resume section — handles upload / status / insights / replace / remove */}
      <ResumeSection user={user} refreshUser={refreshUser} />

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

      {/* Danger zone */}
      <DeleteAccountSection user={user} router={router} />
    </div>
  );
}
