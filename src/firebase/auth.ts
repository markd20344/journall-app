import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  getRedirectResult,
  type User,
} from "firebase/auth";
import { auth } from "./config";

const provider = new GoogleAuthProvider();

/** True when running as an installed PWA (standalone display mode), where popups are unreliable. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

export function signIn(): Promise<void> {
  if (!auth) return Promise.reject(new Error("Firebase is not configured."));
  // Popup avoids a redirect-auth-domain handoff issue caused by third-party
  // storage partitioning in Chrome/Edge on regular browser tabs. Installed
  // PWAs can block popups, so those fall back to the redirect flow.
  if (isStandalone()) {
    return signInWithRedirect(auth, provider);
  }
  return signInWithPopup(auth, provider).then(() => undefined);
}

export function signOutUser(): Promise<void> {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

export function watchAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/** Must be called once on startup to finish a redirect-based sign-in. */
export async function consumeRedirectResult(): Promise<void> {
  if (!auth) return;
  await getRedirectResult(auth);
}
