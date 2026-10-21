import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// When an app is served from Firebase Hosting (*.web.app / *.firebaseapp.com)
// it can use its own origin as the auth domain, so Google sign-in never
// crosses origins — that cross-origin hop is what breaks redirect sign-in
// in installed iOS home-screen apps. Opt-in per app (VITE_AUTH_DOMAIN_FROM_ORIGIN)
// because the GitHub Pages apps have no /__/auth/handler on their origin.
function resolveAuthDomain(): string | undefined {
  const host = typeof window !== "undefined" ? window.location.host : "";
  const onFirebaseHosting = host.endsWith(".web.app") || host.endsWith(".firebaseapp.com");
  if (import.meta.env.VITE_AUTH_DOMAIN_FROM_ORIGIN === "true" && onFirebaseHosting) return host;
  return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey);

export const firebaseApp = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;

// Apps that use Firestore itself as their offline store (Mumu) opt in to its
// persistent IndexedDB cache via VITE_FIRESTORE_PERSISTENT_CACHE. The
// Dexie-based apps keep the default memory cache — Dexie is their offline
// store, and Firestore is only a sync layer for them.
function createFirestore() {
  if (!firebaseApp) return null;
  if (import.meta.env.VITE_FIRESTORE_PERSISTENT_CACHE === "true") {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  }
  return getFirestore(firebaseApp);
}

export const firestore = createFirestore();
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

// Local development and tests against the Firebase emulators
// (`npm run emulators`), never a real project. Set by an app's .env.emulator.
export const usingEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
if (usingEmulators && auth && firestore) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
}
