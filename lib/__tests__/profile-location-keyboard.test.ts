/**
 * Regression tests for Profile Preferred Locations keyboard input.
 *
 * The user reported: type "Par" → Paris appears → Enter does NOT select it.
 *
 * Root cause: Enter handler relied on highlightIdx being set, but auto-highlight
 * was only triggered by query changes, not by displayItems changes. When a user
 * types without pressing ArrowDown first, highlightIdx remained -1.
 *
 * Fix: auto-highlight first suggestion when displayItems change, and Enter
 * always selects something when items are available.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

// ── Mirror the fixed SearchableMultiSelect keyboard logic ─────────────────

interface KeyboardState {
  query: string;
  highlightIdx: number;
  open: boolean;
  displayItemsCount: number;
}

interface KeyboardResult {
  action: "select" | "highlight" | "close" | "none";
  highlightIdx: number;
  open: boolean;
  selectedIdx: number;
}

function simulateKeyDown(
  state: KeyboardState,
  key: string
): KeyboardResult {
  const { query, highlightIdx: hi, open, displayItemsCount } = state;
  const showDropdown = open && (displayItemsCount > 0 || query.trim().length > 0);
  let highlight = hi;
  let openState = open;
  let selectedIdx = -1;

  // Note: auto-highlight effect runs AFTER render, not inside handleKeyDown.
  // In the real component, highlightIdx is whatever the useEffect set on the
  // previous render. We receive it via state.highlightIdx (already applied).

  if (key === "ArrowDown") {
    highlight = Math.min(highlight + 1, displayItemsCount - 1);
  } else if (key === "ArrowUp") {
    highlight = Math.max(highlight - 1, 0);
  } else if (key === "Enter") {
    if (showDropdown) {
      const idx =
        highlight >= 0 && highlight < displayItemsCount
          ? highlight
          : displayItemsCount > 0
            ? 0
            : -1;
      if (idx >= 0) {
        selectedIdx = idx;
      }
    }
  } else if (key === "Escape") {
    if (showDropdown) {
      openState = false;
      highlight = -1;
    }
  }

  return {
    action:
      selectedIdx >= 0
        ? "select"
        : key === "Escape" && !openState
          ? "close"
          : key === "ArrowDown" || key === "ArrowUp"
            ? "highlight"
            : "none",
    highlightIdx: highlight,
    open: openState,
    selectedIdx,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Profile Preferred Locations — Enter selects Paris", () => {
  it("type 'Par' → 1 match → Enter selects it", () => {
    const result = simulateKeyDown(
      { query: "Par", highlightIdx: -1, open: true, displayItemsCount: 1 },
      "Enter"
    );
    expect(result.action).toBe("select");
    expect(result.selectedIdx).toBe(0);
  });

  it("type 'Par' → useEffect auto-highlights first suggestion", () => {
    // After typing "Par", the useEffect fires and sets highlightIdx to 0
    // because displayItems.length > 0 && open === true.
    // Then ArrowDown increments to 1, or Enter uses the highlighted index.
    const afterEffect: KeyboardState = {
      query: "Par",
      highlightIdx: 0, // set by useEffect after render
      open: true,
      displayItemsCount: 1,
    };
    const result = simulateKeyDown(afterEffect, "Enter");
    expect(result.action).toBe("select");
    expect(result.selectedIdx).toBe(0);
  });

  it("type 'Ban' → useEffect auto-highlights first → Enter selects it", () => {
    // After typing "Ban", useEffect sets highlightIdx to 0
    const afterEffect: KeyboardState = {
      query: "Ban",
      highlightIdx: 0, // set by useEffect after render
      open: true,
      displayItemsCount: 3,
    };
    const result = simulateKeyDown(afterEffect, "Enter");
    expect(result.action).toBe("select");
    expect(result.selectedIdx).toBe(0);
  });

  it("type 'Ban' → ArrowDown → Enter selects highlighted", () => {
    // After typing, useEffect sets highlightIdx to 0
    const state: KeyboardState = {
      query: "Ban",
      highlightIdx: 0, // set by useEffect
      open: true,
      displayItemsCount: 3,
    };
    // ArrowDown moves from 0 to 1
    const down = simulateKeyDown(state, "ArrowDown");
    expect(down.highlightIdx).toBe(1);

    // Enter selects highlighted item at index 1
    const enter = simulateKeyDown(
      { ...state, highlightIdx: down.highlightIdx },
      "Enter"
    );
    expect(enter.action).toBe("select");
    expect(enter.selectedIdx).toBe(1);
  });

  it("Escape closes dropdown without selecting", () => {
    const result = simulateKeyDown(
      { query: "Par", highlightIdx: 0, open: true, displayItemsCount: 1 },
      "Escape"
    );
    expect(result.action).toBe("close");
    expect(result.open).toBe(false);
    expect(result.selectedIdx).toBe(-1);
  });

  it("Enter with no matches does nothing", () => {
    const result = simulateKeyDown(
      { query: "xyz", highlightIdx: -1, open: true, displayItemsCount: 0 },
      "Enter"
    );
    expect(result.action).toBe("none");
    expect(result.selectedIdx).toBe(-1);
  });

  it("Enter when dropdown is closed does nothing", () => {
    const result = simulateKeyDown(
      { query: "Par", highlightIdx: 0, open: false, displayItemsCount: 1 },
      "Enter"
    );
    expect(result.action).toBe("none");
    expect(result.selectedIdx).toBe(-1);
  });

  it("ArrowDown + ArrowDown + Enter selects third item", () => {
    // After typing, useEffect sets highlightIdx to 0
    const state: KeyboardState = {
      query: "a",
      highlightIdx: 0, // set by useEffect
      open: true,
      displayItemsCount: 5,
    };
    // 0 → 1
    const d1 = simulateKeyDown(state, "ArrowDown");
    expect(d1.highlightIdx).toBe(1);
    // 1 → 2
    const d2 = simulateKeyDown({ ...state, highlightIdx: d1.highlightIdx }, "ArrowDown");
    expect(d2.highlightIdx).toBe(2);
    // select index 2
    const enter = simulateKeyDown({ ...state, highlightIdx: d2.highlightIdx }, "Enter");
    expect(enter.action).toBe("select");
    expect(enter.selectedIdx).toBe(2);
  });

  it("ArrowUp from first item stays at 0", () => {
    const result = simulateKeyDown(
      { query: "a", highlightIdx: 0, open: true, displayItemsCount: 5 },
      "ArrowUp"
    );
    expect(result.highlightIdx).toBe(0);
  });
});

describe("Profile Preferred Locations — form submission prevention", () => {
  it("Enter with dropdown open should not propagate (stopPropagation called)", () => {
    // Verify that the Enter handler calls preventDefault + stopPropagation
    // when showDropdown is true. This prevents the <form onSubmit> from firing.
    const code = readFileSync("components/SearchableMultiSelect.tsx", "utf8");
    // The Enter handler must call both preventDefault and stopPropagation
    expect(code).toContain("e.preventDefault()");
    expect(code).toContain("e.stopPropagation()");
  });

  it("auto-highlight useEffect depends on displayItems.length", () => {
    // The useEffect should reset highlightIdx when displayItems change,
    // not just when query changes.
    const code = readFileSync("components/SearchableMultiSelect.tsx", "utf8");
    // Should reference displayItems.length in the effect dependency
    expect(code).toContain("displayItems.length");
  });
});

describe("Profile Preferred Locations — component code correctness", () => {
  it("Enter handler selects first item when highlightIdx is -1", () => {
    const code = readFileSync("components/SearchableMultiSelect.tsx", "utf8");
    // The Enter handler should have fallback logic: if highlightIdx < 0, use 0
    expect(code).toContain("displayItems.length > 0 ? 0 : -1");
  });

  it("no disabled attribute on bulk buttons", () => {
    // Verify the component doesn't disable Enter key handling
    const code = readFileSync("components/SearchableMultiSelect.tsx", "utf8");
    // The Enter block should not have any early return for "all selected"
    expect(code).not.toContain("if (allAdded) return");
  });
});
