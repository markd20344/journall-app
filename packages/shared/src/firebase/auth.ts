import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  getRedirectResult,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  type ActionCodeSettings,
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

// Email-link ("magic link") sign-in — a fallback for environments where
// Google's popup/redirect sign-in doesn't work at all (confirmed: an
// installed iOS home-screen icon). There's no popup or cross-origin
// redirect involved, so it sidesteps that whole class of problem: the user
// types their email, gets a link, and opening that link (on the same
// device) completes sign-in entirely within this app's own page.
const PENDING_EMAIL_KEY = "journall:pendingSignInEmail";

/** Emails the user a sign-in link that, when opened, returns to this exact page. */
export async function sendEmailSignInLink(email: string): Promise<void> {
  if (!auth) throw new Error("Firebase is not configured.");
  const actionCodeSettings: ActionCodeSettings = {
    url: window.location.href,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem(PENDING_EMAIL_KEY, email);
}

/** True if the given URL is a sign-in link Firebase generated (i.e. this page was opened from one). */
export function isEmailSignInLink(url: string): boolean {
  if (!auth) return false;
  return isSignInWithEmailLink(auth, url);
}

/** The email sendEmailSignInLink was last called with on this device, if any — lets the same-device case skip re-asking for it. */
export function getStoredSignInEmail(): string | null {
  return window.localStorage.getItem(PENDING_EMAIL_KEY);
}

export async function completeEmailSignIn(email: string, url: string): Promise<void> {
  if (!auth) throw new Error("Firebase is not configured.");
  await signInWithEmailLink(auth, email, url);
  window.localStorage.removeItem(PENDING_EMAIL_KEY);
}
