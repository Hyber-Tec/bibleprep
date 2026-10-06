import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getAuthClient } from "@/lib/firebase/client";
import { ensureProfile } from "@/lib/firebase/db";

/** The part of a Firebase user the app needs. */
export interface AppUser {
  id: string;
  email: string | null;
}

const toAppUser = (user: User | null): AppUser | null => (user ? { id: user.uid, email: user.email } : null);

/** Calls back with the signed-in user, or null, now and on every sign-in and sign-out. */
export function onUserChanged(callback: (user: AppUser | null) => void): () => void {
  return onAuthStateChanged(getAuthClient(), (user) => callback(toAppUser(user)));
}

/** The name an account shows until its owner picks one: the Google name, else the email's local part. */
function defaultDisplayName(user: User): string {
  return (user.displayName?.trim() || user.email?.split("@")[0] || "Friend").slice(0, 60);
}

/** Undo a sign-in that could not finish, so the user is not left half signed in. */
async function abandon(user: User, deleteAccount: boolean) {
  const auth = getAuthClient();
  if (deleteAccount) {
    try {
      await deleteUser(user);
      return;
    } catch {
      // Could not delete it; fall through and at least sign out.
    }
  }
  await signOut(auth);
}

/** Create an email/password account and its profile. Signs the new user in. */
export async function signUpWithEmail(displayName: string, email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(getAuthClient(), email, password);
  try {
    const name = displayName.trim() || email.split("@")[0];
    await updateProfile(user, { displayName: name });
    await ensureProfile(user.uid, name);
  } catch (error) {
    // Without a profile the account is unusable, and the email would be taken: remove it so
    // signing up can be tried again.
    await abandon(user, true);
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getAuthClient(), email, password);
}

/**
 * Sign in with a Google account in a popup. The first time, this is also the sign-up: the
 * profile is created from the Google name.
 */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(getAuthClient(), provider);
  try {
    await ensureProfile(result.user.uid, defaultDisplayName(result.user));
  } catch (error) {
    await abandon(result.user, getAdditionalUserInfo(result)?.isNewUser === true);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuthClient());
}

/** Create the signed-in user's profile if it is missing, e.g. after a sign-up that died halfway. */
export async function ensureCurrentProfile(): Promise<void> {
  const user = getAuthClient().currentUser;
  if (user) await ensureProfile(user.uid, defaultDisplayName(user));
}
