"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function SaveButton({ id }: { id: string }) {
  const { user, loading, savedIds, toggleSaved } = useAuth();
  const router = useRouter();
  const saved = savedIds.has(id);

  if (loading) {
    return <div className="w-9 h-9 rounded-full bg-gray-100" />;
  }

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          // Server-side persistence requires an account — send them to log
          // in rather than silently falling back to localStorage, which
          // would contradict "saved state survives logout/device change".
          router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        await toggleSaved(id);
      }}
      aria-label={saved ? "Remove from saved" : user ? "Save opportunity" : "Log in to save"}
      title={user ? undefined : "Log in to save opportunities"}
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
