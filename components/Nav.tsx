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
