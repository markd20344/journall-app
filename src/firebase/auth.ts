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

export async function signIn(): Promise<void> {
  if (!auth) throw new Error("Firebase is not configured.");
  // Popup avoids a redirect-auth-domain handoff issue caused by third-party
  // storage partitioning (confirmed on both a regular desktop tab and an
  // installed home-screen PWA, where redirect silently failed to complete).
  // Only fall back to redirect if the environment genuinely can't open a
  // popup at all — not for the user simply closing/cancelling it.
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
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
