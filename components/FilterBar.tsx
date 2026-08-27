"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useTransition } from "react";
import { CATEGORIES, COMMON_TAGS } from "@/types/opportunity";

const LOCATION_SUGGESTIONS = ["Remote", "Online", "Global", "India", "Bengaluru", "Bangalore", "United States", "London", "Berlin", "Singapore"];

/**
 * All filter/sort/search state lives in the URL (?q=&category=&location=&tag=&sort=&showClosed=).
 * This makes the feed shareable/bookmarkable and keeps the API route as the
 * single source of truth for query logic — this component just edits the URL.
 */
export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for immediate UI feedback (optimistic updates)
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [tag, setTag] = useState(searchParams.get("tag") || "");
  const [remote, setRemote] = useState(searchParams.get("remote") === "true");
  const [sort, setSort] = useState(searchParams.get("sort") || "recommended");
  const [showClosed, setShowClosed] = useState(searchParams.get("showClosed") === "true");

  // Keep local state in sync with URL if user navigates back/forward
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setCategory(searchParams.get("category") || "");
    setLocation(searchParams.get("location") || "");
    setTag(searchParams.get("tag") || "");
    setRemote(searchParams.get("remote") === "true");
    setSort(searchParams.get("sort") || "recommended");
    setShowClosed(searchParams.get("showClosed") === "true");
  }, [searchParams]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // any filter change resets pagination
      
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  // Debounce keyword search so we don't push a route change per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (query !== (searchParams.get("q") || "")) {
        updateParam("q", query || null);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, updateParam, searchParams]);

  // Debounce location input
  useEffect(() => {
    const handle = setTimeout(() => {
      if (location !== (searchParams.get("location") || "")) {
        updateParam("location", location || null);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [location, updateParam, searchParams]);

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    updateParam("category", val || null);
  };

  const handleTagChange = (val: string) => {
    setTag(val);
    updateParam("tag", val || null);
  };

  const handleSortChange = (val: string) => {
    setSort(val);
    updateParam("sort", val);
  };

  const handleShowClosedChange = (val: boolean) => {
    setShowClosed(val);
    updateParam("showClosed", val ? "true" : null);
  };

  const hasActiveFilters = !!(
    query ||
    category ||
    location ||
    tag ||
    remote ||
    showClosed
  );

  // Category pill buttons (empty = all)
  const categoryOptions = [
    { value: "", label: "All" },
    ...CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div
      className={`rounded-2xl p-4 space-y-3.5 transition-opacity ${isPending ? "opacity-70" : "opacity-100"}`}
      style={{ background: "var(--card)", border: "1px solid var(--line)" }}
    >
      {/* ── Search ──────────────────────────────────────────────── */}
      <input
        type="search"
        aria-label="Search opportunities"
        placeholder="Search opportunities, organisations, tags…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl text-sm transition-shadow"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          color: "var(--ink)",
          fontFamily: "'Inter', sans-serif",
          outline: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lavender-deep)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
      />

      {/* ── Category pills ───────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: "none" }}
        role="group"
        aria-label="Filter by category"
      >
        {categoryOptions.map((opt) => {
          const isActive = category === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleCategoryChange(opt.value)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.01em",
                border: "1px solid",
                borderColor: isActive ? "var(--lavender-deep)" : "var(--line)",
                background: isActive ? "var(--lavender)" : "var(--paper)",
                color: isActive ? "#4A3F8A" : "var(--ink-soft)",
                transform: isActive ? "translateY(-1px)" : "none",
              }}
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* ── Location + Tag row ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Location input with datalist */}
        <div className="relative">
          <input
            type="text"
            aria-label="Filter by location"
            placeholder="Location…"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            list="location-suggestions"
            className="px-3 py-1.5 rounded-xl text-xs transition-shadow"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              border: "1px solid var(--line)",
              background: "var(--paper)",
              color: "var(--ink)",
              outline: "none",
              width: "140px",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lavender-deep)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
          />
          <datalist id="location-suggestions">
            {LOCATION_SUGGESTIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>

        {/* Tag dropdown */}
        <select
          aria-label="Filter by tag"
          value={tag}
          onChange={(e) => handleTagChange(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink)",
            outline: "none",
          }}
        >
          <option value="">All tags</option>
          {COMMON_TAGS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* ── Sort + toggles ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl transition-colors"
          style={{
            border: "1px solid",
            borderColor: remote ? "var(--lavender-deep)" : "var(--line)",
            background: remote ? "var(--lavender)" : "var(--paper)",
          }}
        >
          <input
            type="checkbox"
            checked={remote}
            onChange={(e) => {
              setRemote(e.target.checked);
              updateParam("remote", e.target.checked ? "true" : null);
            }}
            className="sr-only"
          />
          <span className="text-xs">🌐</span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.7rem",
              color: remote ? "#4A3F8A" : "var(--ink-soft)",
            }}
          >
            Remote
          </span>
        </label>

        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value)}
          aria-label="Sort by"
          className="px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink)",
            outline: "none",
          }}
        >
          <option value="recommended">Recommended</option>
          <option value="newest">Newest Added</option>
          <option value="deadline_asc">Deadline soonest</option>
          <option value="score">Highest score</option>
        </select>

        <label
          className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl transition-colors"
          style={{
            border: "1px solid",
            borderColor: showClosed ? "var(--lavender-deep)" : "var(--line)",
            background: showClosed ? "var(--lavender)" : "var(--paper)",
          }}
        >
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => handleShowClosedChange(e.target.checked)}
            className="sr-only"
          />
          <span
            className="w-3 h-3 rounded-sm border flex items-center justify-center"
            style={{
              borderColor: showClosed ? "var(--lavender-deep)" : "var(--ink-soft)",
              background: showClosed ? "var(--lavender-deep)" : "transparent",
            }}
            aria-hidden="true"
          >
            {showClosed && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.7rem",
              color: showClosed ? "#4A3F8A" : "var(--ink-soft)",
            }}
          >
            Show closed
          </span>
        </label>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setQuery("");
              setCategory("");
              setLocation("");
              setTag("");
              setRemote(false);
              setSort("recommended");
              setShowClosed(false);
              startTransition(() => {
                router.push(pathname, { scroll: false });
              });
            }}
            className="ml-auto px-3 py-1.5 rounded-xl text-xs transition-colors"
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
  );
}
