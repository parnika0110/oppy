"use client";

import { useEffect, useState } from "react";
import { isSaved, toggleSaved } from "@/lib/savedStorage";

export default function SaveButton({ id }: { id: string }) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSaved(isSaved(id));
    setMounted(true);
  }, [id]);

  // Avoid hydration mismatch: render a neutral placeholder until mounted,
  // since localStorage isn't available during SSR.
  if (!mounted) {
    return <div className="w-9 h-9 rounded-full bg-gray-100" />;
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved(toggleSaved(id));
      }}
      aria-label={saved ? "Remove from saved" : "Save opportunity"}
      className={`w-9 h-9 flex items-center justify-center rounded-full border transition-colors ${
        saved
          ? "bg-gray-900 border-gray-900 text-white"
          : "bg-white border-gray-300 text-gray-500 hover:border-gray-500"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 4a2 2 0 00-2 2v14l8-5 8 5V6a2 2 0 00-2-2H6z"
        />
      </svg>
    </button>
  );
}
