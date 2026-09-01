import OppyOrb, { type OrbMood } from "./OppyOrb";

/**
 * OppyEmptyState — consistent empty-state pattern with OPPY character.
 * Copy, mood, and action are contextual to each page (not templated).
 */
export default function OppyEmptyState({
  mood = "curious",
  title,
  description,
  action,
  size = 48,
}: {
  mood?: OrbMood;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  size?: number;
}) {
  return (
    <div className="py-16 px-6 text-center rounded-2xl" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
      <div className="flex justify-center mb-5">
        <OppyOrb mood={mood} size={size} />
      </div>
      <p className="font-display font-semibold text-lg" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      {description && (
        <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
          {description}
        </p>
      )}
      {action && (
        <a
          href={action.href}
          className="mt-5 inline-block text-sm font-medium px-4 py-2 rounded-full"
          style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
