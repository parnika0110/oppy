"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useTransition } from "react";
import { CATEGORIES } from "@/types/opportunity";

const INTEREST_OPTIONS = [
  "AI", "Web Development", "Open Source", "Data Science", "Design",
  "Research", "Cybersecurity", "Product Management", "Cloud", "Startups",
  "Mobile", "DevOps", "Python", "Machine Learning", "Fintech",
];

const LOCATION_SUGGESTIONS = [
  "Remote", "Online", "Global", "India", "Bengaluru", "United States",
  "London", "Berlin", "Singapore", "Europe",
];

/**
 * DiscoveryFilters — the single unified filter panel for all discovery contexts.
 *
 * Supports both:
 * - Preference params: ?categories=Job,Hackathon&interests=AI&remote=true
 * - Traditional params: ?q=python&category=Job&location=Remote&tag=Python
 *
 * Always renders: keyword search + category chips + (optional) interest chips
 * + location + remote + sort + showClosed.
 */
export default function DiscoveryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parse all possible URL params
  const currentQ = searchParams.get("q") || "";
  const currentCategory = searchParams.get("category") || "";
  const currentCategories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
  const currentInterests = searchParams.get("interests")?.split(",").filter(Boolean) || [];
  const currentLocation = searchParams.get("location") || "";
  const currentRemote = searchParams.get("remote") === "true";
  const currentSort = searchParams.get("sort") || "recommended";
  const currentShowClosed = searchParams.get("showClosed") === "true";
  const currentTag = searchParams.get("tag") || "";

  // Merge single category into multi for display
  const activeCategories = currentCategories.length > 0
    ? currentCategories
    : currentCategory
    ? [currentCategory]
    : [];

  // Determine if we have preference-based filters
  const hasPreferences = currentCategories.length > 0 || currentInterests.length > 0;

  // Local state for immediate feedback
  const [query, setQuery] = useState(currentQ);
  const [location, setLocation] = useState(currentLocation);
  const [isExpanded, setIsExpanded] = useState(hasPreferences || Boolean(currentQ) || Boolean(currentCategory) || Boolean(currentLocation) || currentRemote || currentShowClosed || Boolean(currentTag));

  // Sync local state with URL on back/forward
  useEffect(() => {
    setQuery(currentQ);
    setLocation(currentLocation);
    setIsExpanded(hasPreferences || Boolean(currentQ) || Boolean(currentCategory) || Boolean(currentLocation) || currentRemote || currentShowClosed || Boolean(currentTag));
  }, [currentQ, currentLocation, currentCategory, currentCategories.join(","), currentInterests.join(","), currentRemote, currentShowClosed, currentTag]);

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

  // Debounced keyword search
  useEffect(() => {
    const handle = setTimeout(() => {
      if (query !== currentQ) {
        updateParams({ q: query.trim() || null });
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, currentQ, updateParams]);

  // Debounced location search
  useEffect(() => {
    const handle = setTimeout(() => {
      if (location !== currentLocation) {
        updateParams({ location: location.trim() || null });
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [location, currentLocation, updateParams]);

  const toggleCategory = (cat: string) => {
    const next = activeCategories.includes(cat)
      ? activeCategories.filter((c) => c !== cat)
      : [...activeCategories, cat];
    // Use categories (plural) for multi-select, fall back to category (singular) for single
    if (next.length === 0) {
      updateParams({ categories: null, category: null });
    } else if (next.length === 1) {
      updateParams({ categories: null, category: next[0] });
    } else {
      updateParams({ category: null, categories: next.join(",") });
    }
  };

  const toggleInterest = (interest: string) => {
    const next = currentInterests.includes(interest)
      ? currentInterests.filter((i) => i !== interest)
      : [...currentInterests, interest];
    updateParams({ interests: next.length > 0 ? next.join(",") : null });
  };

  const clearAll = () => {
    setQuery("");
    setLocation("");
    const params = new URLSearchParams();
    params.set("sort", currentSort);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const hasActiveFilters = Boolean(
    query || activeCategories.length > 0 || currentInterests.length > 0 ||
    currentLocation || currentRemote || currentShowClosed || currentTag
  );

  const activeFilterCount =
    activeCategories.length + currentInterests.length +
    (currentLocation ? 1 : 0) + (currentRemote ? 1 : 0) +
    (currentShowClosed ? 1 : 0) + (query ? 1 : 0);

  return (
    <div
      className="rounded-2xl transition-opacity"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      {/* ── Keyword search (always visible) ──────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        <div className="relative flex items-center rounded-xl border transition-all"
          style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
          <svg className="absolute left-3 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            aria-label="Search opportunities"
            placeholder="Search opportunities, organisations, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full py-2.5 pl-10 pr-9 text-sm bg-transparent outline-none"
            style={{ color: "var(--ink)", fontFamily: "'Space Grotesk', sans-serif" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); updateParams({ q: null }); }}
              className="absolute right-3 p-0.5 rounded-full hover:bg-black/5"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Category chips (always visible) ──────────────────────── */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }} role="group" aria-label="Filter by category">
          <button
            onClick={() => updateParams({ categories: null, category: null })}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-all`}
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
              border: "1px solid", borderColor: activeCategories.length === 0 ? "var(--lavender-deep)" : "var(--line)",
              background: activeCategories.length === 0 ? "var(--lavender)" : "var(--paper)",
              color: activeCategories.length === 0 ? "#4A3F8A" : "var(--ink-soft)",
            }}
            aria-pressed={activeCategories.length === 0}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full transition-all"
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
                  border: "1px solid", borderColor: isActive ? "var(--lavender-deep)" : "var(--line)",
                  background: isActive ? "var(--lavender)" : "var(--paper)",
                  color: isActive ? "#4A3F8A" : "var(--ink-soft)",
                }}
                aria-pressed={isActive}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Expandable refine section ────────────────────────────── */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left border-t"
        style={{ borderColor: "var(--line)" }}
        type="button"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--ink-soft)" }}>
            Refine
          </span>
          {activeFilterCount > 0 && (
            <span className="text-[0.6rem] px-2 py-0.5 rounded-full" style={{ fontFamily: "'JetBrains Mono', monospace", background: "var(--lavender)", color: "#4A3F8A" }}>
              {activeFilterCount} active
            </span>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "var(--ink-soft)" }}>
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3.5" style={{ borderTop: "1px solid var(--line)" }}>
          {/* ── Interest chips ────────────────────────────────────── */}
          <div>
            <p className="text-[0.65rem] mb-2 uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--ink-soft)" }}>
              Interests
            </p>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((interest) => {
                const isActive = currentInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all"
                    type="button"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
                      border: "1px solid",
                      borderColor: isActive ? "var(--lavender-deep)" : "var(--line)",
                      background: isActive ? "var(--lavender)" : "var(--paper)",
                      color: isActive ? "#4A3F8A" : "var(--ink-soft)",
                    }}
                    aria-pressed={isActive}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Location + Remote + Sort ──────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                aria-label="Filter by location"
                placeholder="Location…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                list="discovery-location-suggestions"
                className="px-3 py-1.5 rounded-xl text-xs"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  border: "1px solid var(--line)", background: "var(--paper)",
                  color: "var(--ink)", outline: "none", width: "140px",
                }}
              />
              <datalist id="discovery-location-suggestions">
                {LOCATION_SUGGESTIONS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>

            <button
              onClick={() => updateParams({ remote: currentRemote ? null : "true" })}
              className="text-xs px-3 py-1.5 rounded-xl transition-all"
              type="button"
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
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
              aria-label="Sort by"
              className="px-3 py-1.5 rounded-xl text-xs cursor-pointer"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                border: "1px solid var(--line)", background: "var(--paper)",
                color: "var(--ink)", outline: "none",
              }}
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="deadline_asc">Deadline soonest</option>
              <option value="score">Highest score</option>
            </select>

            <label
              className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-xl transition-colors"
              style={{
                border: "1px solid", borderColor: currentShowClosed ? "var(--lavender-deep)" : "var(--line)",
                background: currentShowClosed ? "var(--lavender)" : "var(--paper)",
              }}
            >
              <input
                type="checkbox"
                checked={currentShowClosed}
                onChange={(e) => updateParams({ showClosed: e.target.checked ? "true" : null })}
                className="sr-only"
              />
              <span className="w-3 h-3 rounded-sm border flex items-center justify-center"
                style={{ borderColor: currentShowClosed ? "var(--lavender-deep)" : "var(--ink-soft)", background: currentShowClosed ? "var(--lavender-deep)" : "transparent" }}>
                {currentShowClosed && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", color: currentShowClosed ? "#4A3F8A" : "var(--ink-soft)" }}>
                Closed
              </span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="ml-auto text-xs px-3 py-1.5 rounded-xl transition-colors"
                type="button"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  border: "1px solid var(--line)", background: "transparent", color: "var(--ink-soft)",
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
