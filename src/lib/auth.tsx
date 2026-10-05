"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface AuthValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;

  // The session comes from the stored cookie, so INITIAL_SESSION needs no network round
  // trip; the middleware has already verified it with the auth server for this page.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      // Token refreshes emit a new object for the same user; keeping the old one stops
      // every page from refetching its data.
      setUser((prev) => (prev?.id === next?.id ? prev : next));
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const fetchProfile = useCallback(
    async (uid: string) => {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
      return (data as Profile) ?? null;
    },
    [supabase]
  );

  // Load the profile once per signed-in user.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let alive = true;
    fetchProfile(userId).then((p) => {
      if (alive) setProfile(p);
    });
    return () => {
      alive = false;
    };
  }, [userId, fetchProfile]);

  /** Reload the profile after changing it (display name, minister status). */
  const refreshProfile = useCallback(async () => {
    if (userId) setProfile(await fetchProfile(userId));
  }, [userId, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Navigate with a full page load after the session changes (log in, sign up, log out).
 * Next.js prefetches links into its client router cache, so a client-side navigation
 * would replay pages fetched under the old session, e.g. the middleware's redirect to
 * /login for pages prefetched while logged out.
 */
export function reloadTo(path: string) {
  window.location.assign(path);
}

/** The `?next=` path to return to after logging in, if it stays on this site. */
export function safeNextPath(next: string | null, fallback = "/read") {
  if (!next) return fallback;
  // Resolving against our origin also catches "//host" and "/\host", which browsers treat as other sites.
  const url = new URL(next, window.location.origin);
  return url.origin === window.location.origin ? url.pathname + url.search + url.hash : fallback;
}
