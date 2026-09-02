"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Check if the browser has an admin session cookie.
 * This is a read-only client check — actual authorization is enforced
 * server-side in middleware.ts and every admin API route.
 */
function hasAdminSession(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("oppy_admin_session=");
}

export default function Nav() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(hasAdminSession());
  }, [user]); // Re-check when auth state changes

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-6 text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
      <a href="/" className="underline-hover hover:text-[var(--ink)] transition-colors">
        Browse
      </a>

      {loading ? null : user ? (
        <>
          <a href="/dashboard" className="underline-hover hover:text-[var(--ink)] transition-colors">
            Dashboard
          </a>
          <a href="/saved" className="underline-hover hover:text-[var(--ink)] transition-colors">
            Saved
          </a>
          <a href="/profile" className="underline-hover hover:text-[var(--ink)] transition-colors">
            Profile
          </a>
          {isAdmin && (
            <a
              href="/admin"
              className="underline-hover hover:text-[var(--ink)] transition-colors"
            >
              Admin
            </a>
          )}
          <button
            onClick={handleLogout}
            className="underline-hover hover:text-[var(--ink)] transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <a href="/login" className="underline-hover hover:text-[var(--ink)] transition-colors">
            Log in
          </a>
          <a
            href="/signup"
            className="underline-hover hover:text-[var(--ink)] transition-colors"
          >
            Sign up
          </a>
        </>
      )}
    </nav>
  );
}
