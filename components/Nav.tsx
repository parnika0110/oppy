"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

export default function Nav() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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
          <button
            onClick={handleLogout}
            className="hover:text-[var(--ink)] transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", letterSpacing: "0.05em" }}
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
            className="hover:text-[var(--ink)] transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", letterSpacing: "0.05em" }}
          >
            Sign up
          </a>
        </>
      )}

      <a
        href="/admin"
        className="hover:text-[var(--ink)] transition-colors"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", letterSpacing: "0.05em", opacity: 0.55 }}
      >
        Admin
      </a>
    </nav>
  );
}
