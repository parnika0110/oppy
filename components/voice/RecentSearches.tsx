"use client";

/**
 * RecentSearches — persisted recent voice/typed searches (localStorage only).
 * Ported from the Gnani app, restyled with OPPY chips.
 */

interface RecentSearchesProps {
  items: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
}

export default function RecentSearches({ items, onSelect, onClear }: RecentSearchesProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-6" aria-label="Recent searches">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="eyebrow">Recent</p>
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-xs cursor-pointer underline-hover bg-transparent border-none p-0"
          style={{ color: "var(--ink-soft)" }}
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            className="chip cursor-pointer hover:border-[var(--accent-deep)] transition-colors"
            onClick={() => onSelect(item)}
            title={item}
          >
            {item.length > 42 ? `${item.slice(0, 41)}…` : item}
          </button>
        ))}
      </div>
    </section>
  );
}
