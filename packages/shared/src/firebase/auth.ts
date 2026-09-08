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

// True when launched from an iOS/iPadOS "Add to Home Screen" icon, or (on
// browsers that support the standard) any installed PWA running in its own
// window chrome — as opposed to a normal browser tab.
function isStandaloneDisplay(): boolean {
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return iosStandalone || mediaStandalone;
}

export interface SignInOptions {
  // Some installed-PWA instances have shown Google's sign-in popup
  // rendering but not accepting keyboard input (confirmed on Kit Runs and
  // Family Tree's home-screen icons on iOS) — redirect works there
  // instead. Opt-in per app rather than a blanket standalone check: this
  // app's own icon has been confirmed working via popup, and the previous
  // attempt at redirect-by-default was found to silently fail to complete
  // in some installed-PWA cases, so it's not a safe global default either
  // way — only flip this where popup is actually confirmed broken.
  forceRedirectInStandalone?: boolean;
}

export async function signIn(options: SignInOptions = {}): Promise<void> {
  if (!auth) throw new Error("Firebase is not configured.");
  if (options.forceRedirectInStandalone && isStandaloneDisplay()) {
    await signInWithRedirect(auth, provider);
    return;
  }
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
