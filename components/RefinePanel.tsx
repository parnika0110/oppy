"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useTransition } from "react";
import { CATEGORIES } from "@/types/opportunity";

const INTEREST_OPTIONS = [
  "AI", "Web Development", "Open Source", "Data Science", "Design",
  "Research", "Cybersecurity", "Product Management", "Cloud", "Startups",
];

const LOCATION_SUGGESTIONS = [
  "Remote", "Online", "Global", "India", "Bengaluru", "United States", "London", "Berlin", "Singapore",
];

export default function RefinePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // Parse current URL params
  const currentCategories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
  const currentInterests = searchParams.get("interests")?.split(",").filter(Boolean) || [];
  const currentLocation = searchParams.get("location") || "";
  const currentRemote = searchParams.get("remote") === "true";
  const currentSort = searchParams.get("sort") || "recommended";
  const currentQ = searchParams.get("q") || "";
  const currentExperience = searchParams.get("experience") || "";

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("page"); // reset pagination on filter change
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  const toggleCategory = (cat: string) => {
    const next = currentCategories.includes(cat)
      ? currentCategories.filter((c) => c !== cat)
      : [...currentCategories, cat];
    updateParams({ categories: next.length > 0 ? next.join(",") : null });
  };

  const toggleInterest = (interest: string) => {
    const next = currentInterests.includes(interest)
      ? currentInterests.filter((i) => i !== interest)
      : [...currentInterests, interest];
    updateParams({ interests: next.length > 0 ? next.join(",") : null });
  };

  const clearAll = () => {
    const params = new URLSearchParams();
    // Keep q if it exists as a search query
    if (currentQ) params.set("q", currentQ);
    params.set("sort", currentSort);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const hasFilters = currentCategories.length > 0 || currentInterests.length > 0 || currentLocation || currentRemote;

  return (
    <div
      className="rounded-2xl transition-opacity mb-2"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        type="button"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-medium text-sm"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--ink)" }}
          >
            Refine
          </span>
          {hasFilters && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: "var(--lavender)",
                color: "#4A3F8A",
              }}
            >
              {currentCategories.length + currentInterests.length + (currentLocation ? 1 : 0) + (currentRemote ? 1 : 0)} active
            </span>
          )}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            color: "var(--ink-soft)",
          }}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--line)" }}>
          {/* Categories */}
          <div>
            <p
              className="text-xs mb-2 uppercase tracking-wider"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--ink-soft)", fontSize: "0.65rem" }}
            >
              Category
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const active = currentCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all"
                    type="button"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.7rem",
                      border: "1px solid",
                      borderColor: active ? "var(--lavender-deep)" : "var(--line)",
                      background: active ? "var(--lavender)" : "var(--paper)",
                      color: active ? "#4A3F8A" : "var(--ink-soft)",
                    }}
                    aria-pressed={active}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interests */}
          <div>
            <p
              className="text-xs mb-2 uppercase tracking-wider"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--ink-soft)", fontSize: "0.65rem" }}
            >
              Interests
            </p>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((interest) => {
                const active = currentInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all"
                    type="button"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.7rem",
                      border: "1px solid",
                      borderColor: active ? "var(--lavender-deep)" : "var(--line)",
                      background: active ? "var(--lavender)" : "var(--paper)",
                      color: active ? "#4A3F8A" : "var(--ink-soft)",
                    }}
                    aria-pressed={active}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location + Remote + Sort row */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Location…"
              value={currentLocation}
              onChange={(e) => updateParams({ location: e.target.value || null })}
              list="refine-location-suggestions"
              className="px-3 py-1.5 rounded-xl text-xs"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
                outline: "none",
                width: "140px",
              }}
            />
            <datalist id="refine-location-suggestions">
              {LOCATION_SUGGESTIONS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>

            <button
              onClick={() => updateParams({ remote: currentRemote ? null : "true" })}
              className="text-xs px-3 py-1.5 rounded-xl transition-all"
              type="button"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.7rem",
                border: "1px solid",
                borderColor: currentRemote ? "var(--lavender-deep)" : "var(--line)",
                background: currentRemote ? "var(--lavender)" : "var(--paper)",
                color: currentRemote ? "#4A3F8A" : "var(--ink-soft)",
              }}
            >
              🌐 Remote
            </button>

            <select
              value={currentSort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="px-3 py-1.5 rounded-xl text-xs cursor-pointer"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
                outline: "none",
              }}
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="deadline_asc">Deadline soonest</option>
              <option value="score">Highest score</option>
            </select>

            {hasFilters && (
              <button
                onClick={clearAll}
                className="ml-auto text-xs px-3 py-1.5 rounded-xl transition-colors"
                type="button"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--ink-soft)",
                }}
              >
                Clear all ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
