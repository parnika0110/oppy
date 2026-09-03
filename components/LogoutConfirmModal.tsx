"use client";

import { useEffect, useRef, useState } from "react";

/**
 * LogoutConfirmModal — accessible confirmation dialog shown before logout.
 *
 * Usage:
 *   <LogoutConfirmModal open={show} onConfirm={handleLogout} onCancel={() => setShow(false)} />
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
      // Small delay so the DOM is ready
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
        className="w-full max-w-sm mx-4"
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "2rem",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
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

        <div className="flex gap-3 justify-end">
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
  );
}
