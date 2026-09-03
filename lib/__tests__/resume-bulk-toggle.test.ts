import { describe, it, expect } from "vitest";

/**
 * Regression tests for the ResumeUpload bulk-selection toggle.
 *
 * The ResumeUpload component maintains two independent lists:
 *   - extracted skills/interests (from the resume — immutable by user actions)
 *   - selected skills/interests (the user's explicit preferences)
 *
 * The toggle button must:
 *   - Show "Add all (N)" when 0 or some are selected
 *   - Show "Remove all" when every extracted item is selected
 *   - "Add all" adds every extracted item to selected
 *   - "Remove all" clears only extracted items from selected, keeping manually added ones
 *   - Never modify the underlying extracted data
 */

// ── Pure logic helpers (mirror ResumeUpload.tsx component state) ─────────

interface BulkToggleState {
  extractedSkills: string[];
  extractedInterests: string[];
  selectedSkills: string[];
  selectedInterests: string[];
}

function hasExtractedSkills(state: BulkToggleState): boolean {
  return state.extractedSkills.length > 0;
}

function hasExtractedInterests(state: BulkToggleState): boolean {
  return state.extractedInterests.length > 0;
}

function unaddedSkills(state: BulkToggleState): string[] {
  return state.extractedSkills.filter((s) => !state.selectedSkills.includes(s));
}

function unaddedInterests(state: BulkToggleState): string[] {
  return state.extractedInterests.filter((i) => !state.selectedInterests.includes(i));
}

function allSkillsSelected(state: BulkToggleState): boolean {
  return hasExtractedSkills(state) && unaddedSkills(state).length === 0;
}

function allInterestsSelected(state: BulkToggleState): boolean {
  return hasExtractedInterests(state) && unaddedInterests(state).length === 0;
}

/** Mirror of toggleAllSkills in ResumeUpload.tsx */
function toggleAllSkills(state: BulkToggleState): BulkToggleState {
  if (!hasExtractedSkills(state)) return state;
  if (allSkillsSelected(state)) {
    return {
      ...state,
      selectedSkills: state.selectedSkills.filter(
        (s) => !state.extractedSkills.includes(s)
      ),
    };
  }
  return {
    ...state,
    selectedSkills: [
      ...new Set([...state.selectedSkills, ...state.extractedSkills]),
    ],
  };
}

/** Mirror of toggleAllInterests in ResumeUpload.tsx */
function toggleAllInterests(state: BulkToggleState): BulkToggleState {
  if (!hasExtractedInterests(state)) return state;
  if (allInterestsSelected(state)) {
    return {
      ...state,
      selectedInterests: state.selectedInterests.filter(
        (i) => !state.extractedInterests.includes(i)
      ),
    };
  }
  return {
    ...state,
    selectedInterests: [
      ...new Set([...state.selectedInterests, ...state.extractedInterests]),
    ],
  };
}

// ── Button label logic ───────────────────────────────────────────────────

function skillsButtonLabel(state: BulkToggleState): string {
  if (allSkillsSelected(state)) return "Remove all";
  return `Add all (${unaddedSkills(state).length})`;
}

function interestsButtonLabel(state: BulkToggleState): string {
  if (allInterestsSelected(state)) return "Remove all";
  return `Add all (${unaddedInterests(state).length})`;
}

// ── Test fixtures ────────────────────────────────────────────────────────

const FULL_STATE: BulkToggleState = {
  extractedSkills: ["Python", "JavaScript", "React", "MongoDB", "Go"],
  extractedInterests: ["AI", "Web3", "Open Source", "DevOps"],
  selectedSkills: [],
  selectedInterests: [],
};

const PARTIAL_STATE: BulkToggleState = {
  extractedSkills: ["Python", "JavaScript", "React", "MongoDB"],
  extractedInterests: ["AI", "Web3", "Open Source"],
  selectedSkills: ["Python", "JavaScript"],
  selectedInterests: ["AI"],
};

const ALL_SELECTED_STATE: BulkToggleState = {
  extractedSkills: ["Python", "JavaScript", "React"],
  extractedInterests: ["AI", "Web3"],
  selectedSkills: ["Python", "JavaScript", "React"],
  selectedInterests: ["AI", "Web3"],
};

const WITH_MANUAL_EXTRAS: BulkToggleState = {
  extractedSkills: ["Python", "JavaScript"],
  extractedInterests: ["AI"],
  // User also manually added "Rust" which is NOT in extracted
  selectedSkills: ["Python", "JavaScript", "Rust"],
  selectedInterests: ["AI", "Blockchain"],
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("Resume bulk toggle — button label", () => {
  it("shows 'Add all (N)' when nothing is selected", () => {
    expect(skillsButtonLabel(FULL_STATE)).toBe("Add all (5)");
    expect(interestsButtonLabel(FULL_STATE)).toBe("Add all (4)");
  });

  it("shows 'Add all (N)' when partially selected", () => {
    expect(skillsButtonLabel(PARTIAL_STATE)).toBe("Add all (2)");
    expect(interestsButtonLabel(PARTIAL_STATE)).toBe("Add all (2)");
  });

  it("shows 'Remove all' when every extracted item is selected", () => {
    expect(skillsButtonLabel(ALL_SELECTED_STATE)).toBe("Remove all");
    expect(interestsButtonLabel(ALL_SELECTED_STATE)).toBe("Remove all");
  });

  it("shows 'Remove all' even with extra manual items selected", () => {
    // All extracted skills are in selectedSkills (plus Rust which is manual)
    const state: BulkToggleState = {
      ...WITH_MANUAL_EXTRAS,
      selectedSkills: ["Python", "JavaScript", "Rust"], // all extracted selected
    };
    expect(skillsButtonLabel(state)).toBe("Remove all");
  });
});

describe("Resume bulk toggle — Add all", () => {
  it("selects all extracted skills when starting from empty", () => {
    const result = toggleAllSkills(FULL_STATE);
    expect(result.selectedSkills).toEqual(
      expect.arrayContaining(["Python", "JavaScript", "React", "MongoDB", "Go"])
    );
    expect(result.selectedSkills.length).toBe(5);
  });

  it("selects all extracted interests when starting from empty", () => {
    const result = toggleAllInterests(FULL_STATE);
    expect(result.selectedInterests).toEqual(
      expect.arrayContaining(["AI", "Web3", "Open Source", "DevOps"])
    );
    expect(result.selectedInterests.length).toBe(4);
  });

  it("adds remaining skills when partially selected", () => {
    const result = toggleAllSkills(PARTIAL_STATE);
    expect(result.selectedSkills).toEqual(
      expect.arrayContaining(["Python", "JavaScript", "React", "MongoDB"])
    );
    expect(result.selectedSkills.length).toBe(4);
  });

  it("adds remaining interests when partially selected", () => {
    const result = toggleAllInterests(PARTIAL_STATE);
    expect(result.selectedInterests).toEqual(
      expect.arrayContaining(["AI", "Web3", "Open Source"])
    );
    expect(result.selectedInterests.length).toBe(3);
  });

  it("preserves manual extras when adding extracted skills", () => {
    const state: BulkToggleState = {
      extractedSkills: ["Python", "JavaScript"],
      extractedInterests: [],
      selectedSkills: ["Rust"], // manual, not in extracted
      selectedInterests: [],
    };
    const result = toggleAllSkills(state);
    expect(result.selectedSkills).toEqual(
      expect.arrayContaining(["Python", "JavaScript", "Rust"])
    );
    expect(result.selectedSkills.length).toBe(3);
  });
});

describe("Resume bulk toggle — Remove all", () => {
  it("removes all extracted skills from selected", () => {
    const result = toggleAllSkills(ALL_SELECTED_STATE);
    expect(result.selectedSkills).toEqual([]);
  });

  it("removes all extracted interests from selected", () => {
    const result = toggleAllInterests(ALL_SELECTED_STATE);
    expect(result.selectedInterests).toEqual([]);
  });

  it("does NOT modify extracted data when removing", () => {
    const result = toggleAllSkills(ALL_SELECTED_STATE);
    expect(result.extractedSkills).toEqual(ALL_SELECTED_STATE.extractedSkills);
  });

  it("does NOT modify extracted interests when removing", () => {
    const result = toggleAllInterests(ALL_SELECTED_STATE);
    expect(result.extractedInterests).toEqual(
      ALL_SELECTED_STATE.extractedInterests
    );
  });

  it("preserves manual extras when removing extracted skills", () => {
    const result = toggleAllSkills(WITH_MANUAL_EXTRAS);
    // "Rust" is manual — it should remain
    expect(result.selectedSkills).toEqual(["Rust"]);
    // extracted items should be gone
    expect(result.selectedSkills).not.toContain("Python");
    expect(result.selectedSkills).not.toContain("JavaScript");
  });

  it("preserves manual extras when removing extracted interests", () => {
    const state: BulkToggleState = {
      extractedSkills: [],
      extractedInterests: ["AI", "Web3"],
      selectedSkills: [],
      selectedInterests: ["AI", "Web3", "Blockchain"], // Blockchain is manual
    };
    const result = toggleAllInterests(state);
    expect(result.selectedInterests).toEqual(["Blockchain"]);
  });
});

describe("Resume bulk toggle — individual deselection after Add all", () => {
  it("after Add all, deselecting one item makes partial state", () => {
    let state = toggleAllSkills(FULL_STATE);
    // Now all 5 are selected. Deselect "React"
    state = {
      ...state,
      selectedSkills: state.selectedSkills.filter((s) => s !== "React"),
    };
    expect(allSkillsSelected(state)).toBe(false);
    expect(skillsButtonLabel(state)).toBe("Add all (1)");
    // The other 4 are still selected
    expect(state.selectedSkills).toEqual(
      expect.arrayContaining(["Python", "JavaScript", "MongoDB", "Go"])
    );
    expect(state.selectedSkills).not.toContain("React");
  });

  it("after Add all interests, deselecting one shows correct count", () => {
    let state = toggleAllInterests(FULL_STATE);
    state = {
      ...state,
      selectedInterests: state.selectedInterests.filter((i) => i !== "AI"),
    };
    expect(allInterestsSelected(state)).toBe(false);
    expect(interestsButtonLabel(state)).toBe("Add all (1)");
  });
});

describe("Resume bulk toggle — toggle cycle", () => {
  it("full cycle: Add all → Remove all returns to empty", () => {
    let state = toggleAllSkills(FULL_STATE);
    expect(state.selectedSkills.length).toBe(5);

    state = toggleAllSkills(state);
    expect(state.selectedSkills.length).toBe(0);
  });

  it("full cycle: Add all → Remove all for interests returns to empty", () => {
    let state = toggleAllInterests(FULL_STATE);
    expect(state.selectedInterests.length).toBe(4);

    state = toggleAllInterests(state);
    expect(state.selectedInterests.length).toBe(0);
  });

  it("full cycle with manual extras: Add all → Remove all preserves manuals", () => {
    let state: BulkToggleState = {
      extractedSkills: ["Python", "JavaScript"],
      extractedInterests: [],
      selectedSkills: ["Rust"],
      selectedInterests: [],
    };

    state = toggleAllSkills(state);
    expect(state.selectedSkills).toEqual(
      expect.arrayContaining(["Python", "JavaScript", "Rust"])
    );

    state = toggleAllSkills(state);
    expect(state.selectedSkills).toEqual(["Rust"]);
  });
});

describe("Resume bulk toggle — edge cases", () => {
  it("no extracted skills: button label is 'Add all (0)'", () => {
    const state: BulkToggleState = {
      extractedSkills: [],
      extractedInterests: ["AI"],
      selectedSkills: [],
      selectedInterests: [],
    };
    // hasExtractedSkills is false, so allSkillsSelected is false
    expect(allSkillsSelected(state)).toBe(false);
    expect(skillsButtonLabel(state)).toBe("Add all (0)");
  });

  it("no extracted skills: toggle is a no-op", () => {
    const state: BulkToggleState = {
      extractedSkills: [],
      extractedInterests: ["AI"],
      selectedSkills: [],
      selectedInterests: [],
    };
    const result = toggleAllSkills(state);
    expect(result.selectedSkills).toEqual([]);
  });

  it("no extracted interests: toggle is a no-op", () => {
    const state: BulkToggleState = {
      extractedSkills: ["Python"],
      extractedInterests: [],
      selectedSkills: [],
      selectedInterests: [],
    };
    const result = toggleAllInterests(state);
    expect(result.selectedInterests).toEqual([]);
  });

  it("duplicate skills in selected are deduplicated", () => {
    const state: BulkToggleState = {
      extractedSkills: ["Python"],
      extractedInterests: [],
      selectedSkills: ["Python", "Python"], // duplicate
      selectedInterests: [],
    };
    // allSkillsSelected should still be true
    expect(allSkillsSelected(state)).toBe(true);
    const result = toggleAllSkills(state);
    // Remove all should clear both
    expect(result.selectedSkills).toEqual([]);
  });
});

describe("Resume bulk toggle — preferences independence", () => {
  it("resumeProfile extracted data is never mutated", () => {
    const originalExtracted = ["Python", "JavaScript", "React"];
    const state: BulkToggleState = {
      extractedSkills: [...originalExtracted],
      extractedInterests: [],
      selectedSkills: [],
      selectedInterests: [],
    };

    // Add all
    let result = toggleAllSkills(state);
    expect(result.extractedSkills).toEqual(originalExtracted);

    // Remove all
    result = toggleAllSkills(result);
    expect(result.extractedSkills).toEqual(originalExtracted);
  });

  it("removing all extracted does not delete manually added preferences", () => {
    const state: BulkToggleState = {
      extractedSkills: ["Python", "JavaScript"],
      extractedInterests: [],
      selectedSkills: ["Python", "JavaScript", "Rust", "TypeScript"],
      selectedInterests: [],
    };

    const result = toggleAllSkills(state);
    // Only extracted items should be removed
    expect(result.selectedSkills).toEqual(["Rust", "TypeScript"]);
  });

  it("Add all does not duplicate existing manual preferences", () => {
    const state: BulkToggleState = {
      extractedSkills: ["Python", "JavaScript"],
      extractedInterests: [],
      selectedSkills: ["Python", "Rust"], // Python already selected
      selectedInterests: [],
    };

    const result = toggleAllSkills(state);
    // Python should appear only once (Set dedup)
    const pythonCount = result.selectedSkills.filter((s) => s === "Python").length;
    expect(pythonCount).toBe(1);
    expect(result.selectedSkills.length).toBe(3); // Python, JavaScript, Rust
  });
});
