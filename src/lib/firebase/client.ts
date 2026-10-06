import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

/**
 * The Firebase web SDK, started on first use rather than on import. Pages are prerendered on
 * the server, and `next build` must not need a Firebase config, so nothing here runs until a
 * component calls it from an effect or an event handler.
 *
 * The web config comes from NEXT_PUBLIC_FIREBASE_* (git-ignored .env.local, template in
 * .env.local.example). It is not a secret; the Firestore rules decide what a visitor can do.
 * With NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true the app talks to `npm run emulators` instead.
 */

const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

// On globalThis so a hot reload in `next dev` reuses the started instances.
const cache = globalThis as typeof globalThis & { __bibleprepFirebase?: Services };

function services(): Services {
  if (cache.__bibleprepFirebase) return cache.__bibleprepFirebase;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error(
      "Firebase is not configured. Copy .env.local.example to .env.local and fill in the NEXT_PUBLIC_FIREBASE_* values."
    );
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      });
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (USE_EMULATORS) {
    // Address the emulators by the host the page itself is on. Google sign-in's popup talks to
    // an iframe of the Auth emulator, and the browser stalls that between "localhost" and
    // "127.0.0.1", which it treats as different sites. The emulators only listen on loopback.
    const host = window.location.hostname === "localhost" ? "localhost" : "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }

  return (cache.__bibleprepFirebase = { app, auth, db });
}

export const getAuthClient = () => services().auth;
export const getDb = () => services().db;

/** Google Analytics. Production builds only, so development traffic stays out of the numbers. */
export async function initAnalytics(): Promise<void> {
  if (USE_EMULATORS || process.env.NODE_ENV !== "production") return;
  if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (await isSupported()) getAnalytics(services().app);
}
