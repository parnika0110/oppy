"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const linkCls = "underline-hover hover:text-[var(--ink)] transition-colors";

export default function Nav() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsAdmin(hasAdminSession());
  }, [user]); // Re-check when auth state changes

  // Close the mobile menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointer(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  // The logout dialog replaces the menu (the button may live inside it).
  useEffect(() => {
    if (showLogoutModal) setMenuOpen(false);
  }, [showLogoutModal]);

  async function handleLogout() {
    setShowLogoutModal(false);
    await logout();
    router.push("/");
    router.refresh();
  }

  const closeMenu = () => setMenuOpen(false);

  /**
   * Shared link set — rendered inline on lg+ screens and inside the
   * collapsible panel below lg. The logout dialog itself is NOT here:
   * it is a portal rendered once at the nav root (it must not double-mount).
   */
  const menuItems = (
    <>
      <a href="/" className={linkCls} onClick={closeMenu}>
        Browse
      </a>

      {loading ? null : user ? (
        <>
          <a href="/dashboard" className={linkCls} onClick={closeMenu}>
            Dashboard
          </a>
          <a href="/saved" className={linkCls} onClick={closeMenu}>
            Saved
          </a>
          <a href="/dashboard/applications" className={linkCls} onClick={closeMenu}>
            Applications
          </a>
          <a href="/profile" className={linkCls} onClick={closeMenu}>
            Profile
          </a>
          {isAdmin && (
            <a href="/admin" className={linkCls} onClick={closeMenu}>
              Admin
            </a>
          )}
          <button
            onClick={() => setShowLogoutModal(true)}
            className={`${linkCls} cursor-pointer bg-transparent border-none p-0 text-left`}
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <a href="/login" className={linkCls} onClick={closeMenu}>
            Log in
          </a>
          <a
            href="/signup"
            onClick={closeMenu}
            className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-85"
            style={{ background: "var(--ink)", color: "var(--paper)", textDecoration: "none" }}
          >
            Sign up
          </a>
        </>
      )}
    </>
  );

  return (
    <nav
      ref={navRef}
      className="relative flex items-center gap-3 lg:gap-6 text-sm font-medium"
      style={{ color: "var(--ink-soft)" }}
    >
      {/* Ask OPPY — voice entry point (adds to, never replaces, text search).
          Always visible: it's the signature action, even on mobile. */}
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

      {/* lg+ : inline row, never wraps */}
      <div className="hidden lg:flex items-center gap-6">{menuItems}</div>

      {/* < lg : hamburger toggling the dropdown panel */}
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="nav-mobile-menu"
        className="lg:hidden inline-flex items-center justify-center p-1.5 rounded-lg cursor-pointer bg-transparent border-none"
        style={{ color: "var(--ink)", border: "1px solid var(--line)" }}
      >
        {menuOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Dropdown panel — absolute inside the nav (position:relative), so the
          header's backdrop-filter never traps it (unlike position:fixed). */}
      {menuOpen && (
        <div
          id="nav-mobile-menu"
          className="lg:hidden absolute right-0 top-full mt-2 min-w-[13rem] rounded-xl p-2 flex flex-col gap-1"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            boxShadow: "0 12px 32px rgba(33, 29, 46, 0.14)",
            zIndex: 50,
          }}
        >
          {menuItems}
        </div>
      )}

      <LogoutConfirmModal
        open={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </nav>
  );
}
