"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { TaxonomyEntry } from "@/lib/taxonomies";

interface SearchableMultiSelectProps {
  entries: TaxonomyEntry[];
  selected: string[];
  onChange: (labels: string[]) => void;
  placeholder?: string;
  popularLabel?: string;
  maxSelections?: number;
}

export default function SearchableMultiSelect({
  entries,
  selected,
  onChange,
  placeholder = "Type to search…",
  popularLabel = "Popular",
  maxSelections = 20,
}: SearchableMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected set for O(1) lookup
  const selectedSet = new Set(selected.map((s) => s.toLowerCase()));

  // Filter entries
  const filtered = query.trim()
    ? entries.filter((e) => {
        if (selectedSet.has(e.label.toLowerCase())) return false;
        const q = query.toLowerCase();
        if (e.label.toLowerCase().includes(q)) return true;
        return e.aliases.some((a) => a.toLowerCase().includes(q));
      })
    : entries.filter((e) => !selectedSet.has(e.label.toLowerCase()));

  // Popular entries (shown when no query)
  const popular = entries.filter(
    (e) => e.popular && !selectedSet.has(e.label.toLowerCase())
  );

  const displayItems = query.trim() ? filtered : popular;

  const select = useCallback(
    (entry: TaxonomyEntry) => {
      if (selectedSet.has(entry.label.toLowerCase())) return;
      if (selected.length >= maxSelections) return;
      onChange([...selected, entry.label]);
      setQuery("");
      setHighlightIdx(-1);
      inputRef.current?.focus();
    },
    [selected, onChange, maxSelections, selectedSet]
  );

  const remove = useCallback(
    (label: string) => {
      onChange(selected.filter((s) => s !== label));
    },
    [selected, onChange]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, displayItems.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (showDropdown) {
        e.preventDefault();
        e.stopPropagation();
        const idx = highlightIdx >= 0 && highlightIdx < displayItems.length
          ? highlightIdx
          : displayItems.length > 0 ? 0 : -1;
        if (idx >= 0) {
          select(displayItems[idx]);
        }
      }
    } else if (e.key === "Escape") {
      if (showDropdown) {
        e.preventDefault();
        setOpen(false);
        setHighlightIdx(-1);
      }
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-highlight first suggestion when filtered results change
  useEffect(() => {
    if (displayItems.length > 0 && open) {
      setHighlightIdx(0);
    } else {
      setHighlightIdx(-1);
    }
  }, [query, displayItems.length, open]);

  const showDropdown = open && (displayItems.length > 0 || query.trim());

  return (
    <div ref={containerRef} className="sms-wrapper">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="sms-chips">
          {selected.map((label) => (
            <span key={label} className="sms-chip">
              <span className="sms-chip-label">{label}</span>
              <button
                type="button"
                onClick={() => remove(label)}
                className="sms-chip-remove"
                aria-label={`Remove ${label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="sms-input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length > 0 ? "Add more…" : placeholder}
          className="sms-input"
          role="combobox"
          aria-expanded={showDropdown ? "true" : "false"}
          aria-haspopup="listbox"
          autoComplete="off"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="sms-dropdown" role="listbox">
          {!query.trim() && popular.length > 0 && (
            <div className="sms-section-label">{popularLabel}</div>
          )}
          {displayItems.slice(0, 50).map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={highlightIdx === i}
              className={`sms-option ${highlightIdx === i ? "sms-option-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(entry);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className="sms-option-label">{entry.label}</span>
              {entry.aliases.length > 0 && (
                <span className="sms-option-alias">
                  {entry.aliases.slice(0, 2).join(", ")}
                </span>
              )}
            </button>
          ))}
          {query.trim() && filtered.length === 0 && (
            <div className="sms-empty">
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .sms-wrapper {
          position: relative;
          width: 100%;
        }
        .sms-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .sms-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          font-family: 'Space Grotesk', sans-serif;
          background: var(--accent-soft, #f0ecf9);
          color: var(--accent-deep, #5b4a9f);
          border: 1px solid var(--accent-soft, #e0d8f0);
        }
        .sms-chip-label {
          line-height: 1.2;
        }
        .sms-chip-remove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 0;
          opacity: 0.6;
          border-radius: 50%;
        }
        .sms-chip-remove:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.08);
        }
        .sms-input-wrap {
          width: 100%;
        }
        .sms-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--line, #e0dcd4);
          background: var(--paper, #faf8f4);
          color: var(--ink, #1a1614);
          font-size: 0.9rem;
          font-family: 'Space Grotesk', sans-serif;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .sms-input:focus {
          border-color: var(--accent, #8b7dc7);
        }
        .sms-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          max-height: 240px;
          overflow-y: auto;
          border-radius: 12px;
          border: 1px solid var(--line, #e0dcd4);
          background: var(--card, #fff);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          z-index: 50;
          padding: 4px;
        }
        .sms-section-label {
          padding: 6px 12px 4px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-soft, #8a8278);
        }
        .sms-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--ink, #1a1614);
          font-size: 0.85rem;
          font-family: 'Space Grotesk', sans-serif;
          text-align: left;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.1s;
        }
        .sms-option:hover {
          background: var(--accent-soft, #f0ecf9);
        }
        .sms-option-active {
          background: var(--accent-soft, #f0ecf9);
          outline: 2px solid var(--accent, #8b7dc7);
          outline-offset: -2px;
        }
        .sms-option-label {
          font-weight: 500;
        }
        .sms-option-alias {
          font-size: 0.75rem;
          color: var(--ink-soft, #8a8278);
          font-style: italic;
        }
        .sms-empty {
          padding: 12px;
          text-align: center;
          font-size: 0.8rem;
          color: var(--ink-soft, #8a8278);
        }
      `}</style>
    </div>
  );
}
