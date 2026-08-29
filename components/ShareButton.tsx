"use client";

import { useState, useRef, useEffect } from "react";

/**
 * ShareButton — Share an opportunity via link, Twitter, or LinkedIn.
 * Shows a dropdown menu on click.
 */
export default function ShareButton({
  title,
  url,
  organization,
}: {
  title: string;
  url: string;
  organization?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
  }

  function shareTwitter() {
    const text = `${title}${organization ? ` at ${organization}` : ""}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  }

  function shareLinkedIn() {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
        title="Share"
        aria-label="Share this opportunity"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-xl border shadow-lg overflow-hidden"
          style={{
            background: "var(--paper)",
            borderColor: "var(--line)",
            minWidth: "160px",
          }}
        >
          <button
            onClick={copyLink}
            className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-black/5 transition-colors flex items-center gap-2"
            style={{ color: "var(--ink)" }}
          >
            {copied ? "✓ Copied!" : "🔗 Copy link"}
          </button>
          <button
            onClick={shareTwitter}
            className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-black/5 transition-colors flex items-center gap-2"
            style={{ color: "var(--ink)" }}
          >
            𝕏 Share on Twitter
          </button>
          <button
            onClick={shareLinkedIn}
            className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-black/5 transition-colors flex items-center gap-2"
            style={{ color: "var(--ink)" }}
          >
            in Share on LinkedIn
          </button>
        </div>
      )}
    </div>
  );
}
