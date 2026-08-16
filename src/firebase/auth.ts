import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  getRedirectResult,
  type User,
} from "firebase/auth";
import { auth } from "./config";

const provider = new GoogleAuthProvider();

export function signIn(): Promise<void> {
  if (!auth) return Promise.reject(new Error("Firebase is not configured."));
  return signInWithRedirect(auth, provider);
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
