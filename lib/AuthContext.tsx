"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  onboardingComplete: boolean;
  preferences: Record<string, any>;
  resumeProfile?: {
    uploaded: boolean;
    extractedSkills: string[];
    extractedInterests: string[];
    projects: Array<{ title: string; technologies: string[]; description?: string }>;
    experience: Array<{ role: string; organization: string; duration?: string; description?: string }>;
    education: Array<{ institution: string; degree?: string; field?: string; year?: string }>;
    achievements: string[];
    domains: string[];
    parsedAt: string;
  };
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  savedIds: Set<string>;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  toggleSaved: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user);

      // Persist avatar to localStorage for instant theme application
      if (data.user?.avatar) {
        try { localStorage.setItem("oppy_avatar", data.user.avatar); } catch {}
      }

      // Load saved IDs
      if (data.user) {
        const savedRes = await fetch("/api/saved");
        const savedData = await savedRes.json();
        const ids = new Set<string>((savedData.items || []).map((item: any) => item._id));
        setSavedIds(ids);
      } else {
        setSavedIds(new Set());
      }
    } catch {
      setUser(null);
      setSavedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      setUser(data.user);
      await fetchUser(); // refresh saved IDs
      return {};
    } catch {
      return { error: "Login failed." };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      setUser(data.user);
      return {};
    } catch {
      return { error: "Signup failed." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setSavedIds(new Set());
      try { localStorage.removeItem("oppy_avatar"); } catch {}
    }
  };

  const router = useRouter();

  const toggleSaved = async (id: string) => {
    const isSaved = savedIds.has(id);
    try {
      let res: Response;
      if (isSaved) {
        res = await fetch(`/api/saved?opportunityId=${id}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId: id }),
        });
      }

      if (res.status === 401) {
        // Session expired or invalid — send user to log in
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!res.ok) {
        // Non-401 server error — don't update local state
        console.error("[Saved] API error:", res.status);
        return;
      }

      // Only update local state after confirmed success
      if (isSaved) {
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        setSavedIds((prev) => new Set(prev).add(id));
      }
    } catch {
      console.error("[Saved] Network error: could not reach server.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, savedIds, login, signup, logout, refreshUser: fetchUser, toggleSaved }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
