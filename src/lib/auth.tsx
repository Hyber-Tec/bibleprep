"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Profile } from "@/lib/types";
import { getProfile } from "@/lib/firebase/db";
import {
  ensureCurrentProfile,
  onUserChanged,
  signInWithEmail,
  signInWithGoogle as googleSignIn,
  signOutUser,
  signUpWithEmail,
  type AppUser,
} from "@/lib/firebase/auth";

interface AuthValue {
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;

  // Signing up or in also writes the user's profile. Firebase reports a new user as soon as
  // the account exists, so the user is only handed to the app once the action that caused it
  // has finished: no page ever sees a signed-in user whose profile is still being created.
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const track = useCallback(<T,>(action: Promise<T>) => {
    pending.current = action.catch(() => undefined);
    return action;
  }, []);

  useEffect(() => {
    try {
      return onUserChanged((next) => {
        void pending.current.then(() => {
          // Keep the old object for the same user, so pages don't refetch their data.
          setUser((prev) => (prev?.id === next?.id ? prev : next));
          setLoading(false);
        });
      });
    } catch (error) {
      // Firebase is not configured (see .env.local.example): leave the public pages usable.
      console.error(error);
      setLoading(false);
    }
  }, []);

  // Load the profile once per signed-in user.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let alive = true;
    (async () => {
      let found = await getProfile(userId);
      if (!found) {
        // Signed in without a profile, e.g. a sign-up that died halfway: create it now.
        await ensureCurrentProfile();
        found = await getProfile(userId);
      }
      if (alive) setProfile(found);
    })().catch((error) => console.error("Could not load the profile", error));
    return () => {
      alive = false;
    };
  }, [userId]);

  /** Reload the profile after changing it (display name, minister status). */
  const refreshProfile = useCallback(async () => {
    if (userId) setProfile(await getProfile(userId));
  }, [userId]);

  const signUp = useCallback(
    (displayName: string, email: string, password: string) =>
      track(signUpWithEmail(displayName, email, password)),
    [track]
  );
  const signIn = useCallback((email: string, password: string) => track(signInWithEmail(email, password)), [track]);
  const signInWithGoogle = useCallback(() => track(googleSignIn()), [track]);

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, refreshProfile, signUp, signIn, signInWithGoogle, signOut }}
    >
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
 * Navigate with a full page load after the session changes (log in, sign up, log out), so the
 * next page starts from a clean slate instead of inheriting the previous user's data.
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
