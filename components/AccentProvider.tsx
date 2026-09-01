"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Maps user avatar color IDs to accent CSS variable values.
 * These override the default lavender accent defined in globals.css :root.
 */
export const ACCENT_MAP: Record<string, { light: string; deep: string }> = {
  lavender: { light: "#D2C9EE", deep: "#8B7DC7" },
  peach:    { light: "#F0C6A0", deep: "#C98A4B" },
  sage:     { light: "#B3CDA8", deep: "#6E9463" },
  ink:      { light: "#D2C9EE", deep: "#211D2E" },
  blue:     { light: "#ACCEDF", deep: "#5D8BA3" },
  rose:     { light: "#E8BFC4", deep: "#B76E79" },
};

const DEFAULT_ACCENT = ACCENT_MAP.lavender;
const STORAGE_KEY = "oppy_avatar";

/** Resolve accent colors from an avatar ID. */
export function getAccent(avatarId?: string | null) {
  return (avatarId && ACCENT_MAP[avatarId]) || DEFAULT_ACCENT;
}

/** Apply accent CSS variables to the document root. */
function applyAccent(accent: { light: string; deep: string }) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent", accent.light);
  root.style.setProperty("--accent-deep", accent.deep);
}

// ── Accent context ────────────────────────────────────────────────────

interface AccentContextType {
  light: string;
  deep: string;
}

const AccentContext = createContext<AccentContextType>(DEFAULT_ACCENT);

/**
 * Hook to get the current accent colors for use in components like OppyOrb.
 */
export function useAccent() {
  return useContext(AccentContext);
}

// ── Provider ──────────────────────────────────────────────────────────

export default function AccentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Phase 1: Read localStorage synchronously on first render for instant theme
  const [initialAvatar] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Apply initial theme from localStorage (runs synchronously after first render)
  useEffect(() => {
    if (initialAvatar) {
      applyAccent(getAccent(initialAvatar));
    }
  }, [initialAvatar]);

  // Determine current accent
  const accent = getAccent(user?.avatar);

  // Phase 2: Confirm/override from auth state (covers login, logout, avatar change)
  useEffect(() => {
    applyAccent(accent);

    // Cleanup on unmount (logout) — restore defaults
    return () => {
      applyAccent(DEFAULT_ACCENT);
    };
  }, [accent]);

  return (
    <AccentContext.Provider value={accent}>
      {children}
    </AccentContext.Provider>
  );
}
