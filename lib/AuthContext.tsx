"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  onboardingComplete: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  savedIds: Set<string>;
  refreshUser: () => Promise<void>;
  refreshSaved: () => Promise<void>;
  /** Toggle save state server-side. Returns the new saved state, or null if not logged in. */
  toggleSaved: (opportunityId: string) => Promise<boolean | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/saved");
      if (!res.ok) {
        setSavedIds(new Set());
        return;
      }
      const data = await res.json();
      setSavedIds(new Set((data.items || []).map((i: any) => i._id)));
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) refreshSaved();
    else setSavedIds(new Set());
  }, [user, refreshSaved]);

  const toggleSaved = useCallback(
    async (opportunityId: string): Promise<boolean | null> => {
      if (!user) return null;
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (data.saved) next.add(opportunityId);
        else next.delete(opportunityId);
        return next;
      });
      return data.saved as boolean;
    },
    [user]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSavedIds(new Set());
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, savedIds, refreshUser, refreshSaved, toggleSaved, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
