"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutConfirmModal from "./LogoutConfirmModal";

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
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    setIsAdmin(hasAdminSession());
  }, [user]); // Re-check when auth state changes

  async function handleLogout() {
    setShowLogoutModal(false);
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      className="flex items-center gap-6 text-sm font-medium flex-wrap justify-end"
      style={{ color: "var(--ink-soft)" }}
    >
      {/* Ask OPPY — voice entry point (adds to, never replaces, text search) */}
      <a
        href="/voice"
        title="Ask OPPY — voice search"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-85"
        style={{
          background: "var(--accent)",
          color: "#3A3168",
          border: "1px solid var(--accent-deep)",
          whiteSpace: "nowrap",
          textDecoration: "none",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Ask OPPY
      </a>

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
          <a href="/dashboard/applications" className="underline-hover hover:text-[var(--ink)] transition-colors">
            Applications
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
            onClick={() => setShowLogoutModal(true)}
            className="underline-hover hover:text-[var(--ink)] transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            Logout
          </button>
          <LogoutConfirmModal
            open={showLogoutModal}
            onConfirm={handleLogout}
            onCancel={() => setShowLogoutModal(false)}
          />
        </>
      ) : (
        <>
          <a href="/login" className="underline-hover hover:text-[var(--ink)] transition-colors">
            Log in
          </a>
          <a
            href="/signup"
            className="inline-flex items-center px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-85"
            style={{ background: "var(--ink)", color: "var(--paper)", textDecoration: "none" }}
          >
            Sign up
          </a>
        </>
      )}
    </nav>
  );
}
