"use client";

import { useState, useRef, useCallback } from "react";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import {
  SKILL_TAXONOMY,
  INTEREST_TAXONOMY_ENTRIES,
} from "@/lib/taxonomies";

interface ExtractedProfile {
  extractedSkills: string[];
  extractedInterests: string[];
  projects: Array<{ title: string; technologies: string[]; description?: string }>;
  experience: Array<{ role: string; organization: string; duration?: string; description?: string }>;
  education: Array<{ institution: string; degree?: string; field?: string; year?: string }>;
  achievements: string[];
  domains: string[];
}

interface ResumeUploadProps {
  /**
   * Called when the user confirms which extracted items they want
   * as their current explicit preferences.
   *
   * IMPORTANT: These values become the user's explicit preferences.
   * The full resume profile is already stored separately via /api/resume/upload.
   * Only pass values the user explicitly chose — do NOT auto-fill.
   */
  onConfirm: (confirmedSkills: string[], confirmedInterests: string[]) => void;
  /** Called when the user chooses to skip/resume upload */
  onSkip: () => void;
}

type Phase = "upload" | "parsing" | "review" | "error";

export default function ResumeUpload({ onConfirm, onSkip }: ResumeUploadProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string>("");
  const [extracted, setExtracted] = useState<ExtractedProfile | null>(null);
  // Start EMPTY — user explicitly adds what they want as current preferences
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setPhase("parsing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse resume.");
      }

      const profile = data.resumeProfile as ExtractedProfile;
      setExtracted(profile);
      // Do NOT pre-fill selectedSkills/selectedInterests.
      // The full profile is already saved to resumeProfile by the API.
      // User explicitly chooses which items become current preferences.
      setSelectedSkills([]);
      setSelectedInterests([]);
      setPhase("review");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  /** Toggle a suggested item into/out of the selected list */
  function toggleSuggested(
    item: string,
    selected: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    if (selected.includes(item)) {
      setter(selected.filter((s) => s !== item));
    } else {
      setter([...selected, item]);
    }
  }

  // ── Upload Phase ─────────────────────────────────────────────────────

  if (phase === "upload" || phase === "error") {
    return (
      <div className="space-y-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center
            transition-all duration-200
            ${dragOver
              ? "border-oppy-purple bg-oppy-purple/5"
              : "border-stone-300 hover:border-oppy-purple/50 hover:bg-stone-50"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-4xl mb-4">📄</div>
          <p className="text-lg font-medium text-stone-800 mb-2">
            Drop your resume here
          </p>
          <p className="text-sm text-stone-500">
            PDF or DOCX, up to 5MB
          </p>
        </div>

        {phase === "error" && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={onSkip}
          className="w-full py-3 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          Skip — I&apos;ll fill it in manually →
        </button>
      </div>
    );
  }

  // ── Parsing Phase ────────────────────────────────────────────────────

  if (phase === "parsing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-12 h-12 border-4 border-oppy-purple/30 border-t-oppy-purple rounded-full animate-spin" />
        <p className="text-stone-600 font-medium">Reading your resume…</p>
        <p className="text-sm text-stone-400">This usually takes a few seconds</p>
      </div>
    );
  }

  // ── Review Phase ─────────────────────────────────────────────────────

  const hasExtractedSkills = (extracted?.extractedSkills.length ?? 0) > 0;
  const hasExtractedInterests = (extracted?.extractedInterests.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-oppy-purple/5 border border-oppy-purple/20 p-5">
        <h3 className="font-display text-lg font-bold text-stone-900 mb-1">
          We found your profile ✨
        </h3>
        <p className="text-sm text-stone-600">
          We detected skills and interests from your resume. Click to add the ones
          you want OPPY to use for matching. Your full resume profile is saved separately.
        </p>
      </div>

      {/* Extracted Summary */}
      {extracted && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {extracted.projects.length > 0 && (
            <div className="rounded-xl bg-stone-50 p-3">
              <span className="text-2xl font-bold text-oppy-purple">{extracted.projects.length}</span>
              <span className="text-stone-600 ml-2">projects detected</span>
            </div>
          )}
          {extracted.experience.length > 0 && (
            <div className="rounded-xl bg-stone-50 p-3">
              <span className="text-2xl font-bold text-oppy-purple">{extracted.experience.length}</span>
              <span className="text-stone-600 ml-2">experience entries</span>
            </div>
          )}
          {extracted.education.length > 0 && (
            <div className="rounded-xl bg-stone-50 p-3">
              <span className="text-2xl font-bold text-oppy-purple">{extracted.education.length}</span>
              <span className="text-stone-600 ml-2">education entries</span>
            </div>
          )}
          {extracted.achievements.length > 0 && (
            <div className="rounded-xl bg-stone-50 p-3">
              <span className="text-2xl font-bold text-oppy-purple">{extracted.achievements.length}</span>
              <span className="text-stone-600 ml-2">achievements</span>
            </div>
          )}
        </div>
      )}

      {/* Suggested Skills — click to add as current preference */}
      {hasExtractedSkills && (
        <div>
          <label className="block text-sm font-semibold text-stone-800 mb-2">
            Detected skills — click to add as your current preferences
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {extracted!.extractedSkills.map((skill) => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSuggested(skill, selectedSkills, setSelectedSkills)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-oppy-purple text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
                  }`}
                >
                  {isSelected && "✓ "}{skill}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Additional Skills — search and add manually */}
      <div>
        <label className="block text-sm font-semibold text-stone-800 mb-2">
          {hasExtractedSkills ? "Add more skills" : "Skills"}
        </label>
        <SearchableMultiSelect
          entries={SKILL_TAXONOMY}
          selected={selectedSkills}
          onChange={setSelectedSkills}
          placeholder="Search skills…"
          maxSelections={15}
        />
      </div>

      {/* Suggested Interests — click to add as current preference */}
      {hasExtractedInterests && (
        <div>
          <label className="block text-sm font-semibold text-stone-800 mb-2">
            Detected interests — click to add as your current preferences
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {extracted!.extractedInterests.map((interest) => {
              const isSelected = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleSuggested(interest, selectedInterests, setSelectedInterests)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-oppy-purple text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
                  }`}
                >
                  {isSelected && "✓ "}{interest}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Additional Interests — search and add manually */}
      <div>
        <label className="block text-sm font-semibold text-stone-800 mb-2">
          {hasExtractedInterests ? "Add more interests" : "Interests"}
        </label>
        <SearchableMultiSelect
          entries={INTEREST_TAXONOMY_ENTRIES}
          selected={selectedInterests}
          onChange={setSelectedInterests}
          placeholder="Search interests…"
          maxSelections={10}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onConfirm(selectedSkills, selectedInterests)}
          className="flex-1 py-3 px-6 rounded-xl bg-oppy-purple text-white font-semibold
                     hover:bg-oppy-purple/90 transition-colors"
        >
          {selectedSkills.length > 0 || selectedInterests.length > 0
            ? `Continue with ${selectedSkills.length + selectedInterests.length} selected →`
            : "Skip — don&apos;t add any to preferences →"
          }
        </button>
        <button
          onClick={onSkip}
          className="py-3 px-6 rounded-xl border border-stone-300 text-stone-600
                     hover:bg-stone-50 transition-colors"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
