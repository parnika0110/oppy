"use client";

import OppyOrb, { type OrbMood } from "./OppyOrb";
import { useAccent } from "./AccentProvider";

/**
 * ThemedOppyOrb — renders OppyOrb with the current accent theme.
 * Use this from any component that needs a themed mascot orb.
 * Especially useful in server components that can't use useAccent() directly.
 */
export default function ThemedOppyOrb({
  mood = "welcoming",
  size = 48,
  className,
}: {
  mood?: OrbMood;
  size?: number;
  className?: string;
}) {
  const accent = useAccent();
  return (
    <OppyOrb
      mood={mood}
      size={size}
      className={className}
      accentLight={accent.light}
      accentDeep={accent.deep}
    />
  );
}
