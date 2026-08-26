"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useTransition } from "react";
import { CATEGORIES } from "@/types/opportunity";

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
  const [sort, setSort] = useState(searchParams.get("sort") || "recommended");
  const [showClosed, setShowClosed] = useState(searchParams.get("showClosed") === "true");

  // Keep local state in sync with URL if user navigates back/forward
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setCategory(searchParams.get("category") || "");
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

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    updateParam("category", val || null);
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
    searchParams.get("location") ||
    searchParams.get("tag") ||
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

      {/* ── Sort + toggles ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
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

