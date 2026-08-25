"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { CATEGORIES, COMMON_LOCATIONS, COMMON_TAGS } from "@/types/opportunity";

/**
 * All filter/sort/search state lives in the URL (?q=&category=&location=&tag=&sort=&showExpired=).
 * This makes the feed shareable/bookmarkable and keeps the API route as the
 * single source of truth for query logic — this component just edits the URL.
 */
export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");

  // Debounce keyword search so we don't push a route change per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      updateParam("q", query || null);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // any filter change resets pagination
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const category = searchParams.get("category") || "";
  const location = searchParams.get("location") || "";
  const tag = searchParams.get("tag") || "";
  const sort = searchParams.get("sort") || "newest";
  const showExpired = searchParams.get("showExpired") === "true";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <input
        type="text"
        placeholder="Search opportunities..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => updateParam("category", e.target.value || null)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={location}
          onChange={(e) => updateParam("location", e.target.value || null)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Locations</option>
          {COMMON_LOCATIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <select
          value={tag}
          onChange={(e) => updateParam("tag", e.target.value || null)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Tags</option>
          {COMMON_TAGS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="deadline_asc">Soonest Deadline</option>
          <option value="deadline_desc">Latest Deadline</option>
          <option value="newest">Newest Added</option>
        </select>

        <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showExpired}
            onChange={(e) => updateParam("showExpired", e.target.checked ? "true" : null)}
          />
          Show closed
        </label>
      </div>
    </div>
  );
}
