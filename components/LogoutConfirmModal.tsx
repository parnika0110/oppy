"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * LogoutConfirmModal — accessible confirmation dialog shown before logout.
 *
 * WHY A PORTAL:
 * The modal is rendered from <Nav>, which lives inside the sticky <header>
 * whose inline style applies backdrop-filter. Any ancestor with
 * backdrop-filter/filter/transform/contain becomes the containing block for
 * position:fixed descendants, so inset:0 would resolve to the ~header-height
 * box instead of the viewport — clipping the top of the dialog. Rendering
 * into document.body via createPortal escapes every such ancestor.
 *
 * LAYOUT:
 *  - A fixed, full-viewport scroll container owns the dark/blur backdrop.
 *  - Inside it, a min-height:100% flex wrapper centers the dialog when it
 *    fits and lets the outer container scroll when it does not, so the top
 *    of a tall dialog is never clipped (no fixed top offset centering).
 *  - Body scroll is locked while open.
 */
export default function LogoutConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button on open
  useEffect(() => {
    if (open) {
      setProcessing(false);
      const id = requestAnimationFrame(() => cancelRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    if (processing) return;
    setProcessing(true);
    try {
      await onConfirm();
    } finally {
      setProcessing(false);
    }
  }

  return createPortal(
    // Fixed scroll container: owns the full-viewport backdrop and scrolls
    // when the dialog is taller than the viewport.
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflowY: "auto",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(2px)",
      }}
    >
      {/* Flex wrapper: centers the dialog when it fits; grows to scroll
          naturally (top always reachable) when it does not. */}
      <div
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          aria-describedby="logout-desc"
          style={{
            width: "100%",
            maxWidth: 340,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: "2rem",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="logout-title"
            className="font-display font-semibold"
            style={{ fontSize: "1.25rem", color: "var(--ink)", marginBottom: "0.5rem" }}
          >
            Leaving already? 👀
          </h2>
          <p
            id="logout-desc"
            style={{ fontSize: "0.9rem", color: "var(--ink-soft)", marginBottom: "1.5rem", lineHeight: 1.5 }}
          >
            You can always come back when opportunity calls.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={processing}
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
                fontSize: "0.85rem",
                fontWeight: 600,
                fontFamily: "'Space Grotesk', sans-serif",
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.6 : 1,
              }}
            >
              Stay
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={processing}
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: 10,
                border: "none",
                background: processing ? "var(--ink-soft)" : "#991B1B",
                color: "var(--paper)",
                fontSize: "0.85rem",
                fontWeight: 600,
                fontFamily: "'Space Grotesk', sans-serif",
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.7 : 1,
              }}
            >
              {processing ? "Logging out…" : "Log out"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
