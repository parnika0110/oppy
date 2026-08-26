"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser, savedIds } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [locations, setLocations] = useState("");
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
          setSkills((prefs.skills || []).join(", "));
          setInterests((prefs.interests || []).join(", "));
          setLocations((prefs.locations || []).join(", "));
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
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
          locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
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
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Skills (comma-separated)</label>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Python, React, Machine Learning"
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
          />
        </div>

        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Interests (comma-separated)</label>
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="AI, Startups, Open Source"
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
          />
        </div>

        <div>
          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Preferred locations (comma-separated)</label>
          <input
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="India, Bengaluru"
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{ border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
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
