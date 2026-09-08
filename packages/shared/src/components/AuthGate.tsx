import { useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  completeEmailSignIn,
  consumeRedirectResult,
  getStoredSignInEmail,
  isEmailSignInLink,
  sendEmailSignInLink,
  signIn,
  watchAuthState,
} from "../firebase/auth";
import { firebaseEnabled } from "../firebase/config";

export interface AuthGateProps {
  children: ReactNode;
  /** Shown on the sign-in screen and the loading state, e.g. "Journall OS". */
  appTitle: string;
  /** Sentence under the app title on the sign-in screen. */
  signInPrompt: string;
  /**
   * Runs once per sign-in, before children render — start this app's own
   * cloud sync (and any post-sync cleanup) here. A "Syncing…" banner shows
   * while the returned promise is pending.
   */
  onSignedIn?: (user: User) => Promise<void>;
  /** Runs when the user signs out (or on unmount while signed in) — stop this app's sync here. */
  onSignedOut?: () => void;
  /** See SignInOptions.forceRedirectInStandalone — only set this where popup is confirmed broken in an installed PWA. */
  forceRedirectInStandalone?: boolean;
}

type EmailLinkState =
  | { step: "idle" }
  | { step: "needs-email" } // opened a sign-in link on a device/browser with no remembered email
  | { step: "completing" }
  | { step: "form-hidden" }
  | { step: "form-open" }
  | { step: "sending" }
  | { step: "sent" };

export default function AuthGate({
  children,
  appTitle,
  signInPrompt,
  onSignedIn,
  onSignedOut,
  forceRedirectInStandalone,
}: AuthGateProps) {
  const [checkedRedirect, setCheckedRedirect] = useState(false);
  const [checkedEmailLink, setCheckedEmailLink] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailLink, setEmailLink] = useState<EmailLinkState>({ step: "form-hidden" });
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    consumeRedirectResult()
      .catch((err) => setError(err instanceof Error ? err.message : "Sign-in failed."))
      .finally(() => setCheckedRedirect(true));
  }, []);

  // A sign-in email link, opened on the same device that requested it, can
  // complete immediately with no user input — the popup/redirect flows
  // above don't work at all inside an installed iOS home-screen app, so
  // this is the one sign-in path guaranteed to work there too, since it
  // never leaves this page.
  useEffect(() => {
    const href = window.location.href;
    if (!isEmailSignInLink(href)) {
      setCheckedEmailLink(true);
      return;
    }
    const storedEmail = getStoredSignInEmail();
    if (!storedEmail) {
      setEmailLink({ step: "needs-email" });
      setCheckedEmailLink(true);
      return;
    }
    setEmailLink({ step: "completing" });
    completeEmailSignIn(storedEmail, href)
      .then(() => {
        window.history.replaceState(null, "", window.location.pathname);
        setEmailLink({ step: "form-hidden" });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "That sign-in link didn't work — request a new one.");
        setEmailLink({ step: "needs-email" });
      })
      .finally(() => setCheckedEmailLink(true));
  }, []);

  useEffect(() => {
    const unsubscribe = watchAuthState((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      onSignedOut?.();
      return;
    }
    if (!onSignedIn) return;
    setSyncing(true);
    setError(null);
    onSignedIn(user)
      .catch((err) => setError(err instanceof Error ? err.message : "Cloud sync failed to start."))
      .finally(() => setSyncing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleConfirmEmailForLink() {
    if (!emailInput.trim()) return;
    setError(null);
    setEmailLink({ step: "completing" });
    try {
      await completeEmailSignIn(emailInput.trim(), window.location.href);
      window.history.replaceState(null, "", window.location.pathname);
      setEmailLink({ step: "form-hidden" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That sign-in link didn't work — request a new one.");
      setEmailLink({ step: "needs-email" });
    }
  }

  async function handleSendEmailLink() {
    if (!emailInput.trim()) return;
    setError(null);
    setEmailLink({ step: "sending" });
    try {
      await sendEmailSignInLink(emailInput.trim());
      setEmailLink({ step: "sent" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that link — try again.");
      setEmailLink({ step: "form-open" });
    }
  }

  if (!firebaseEnabled) {
    // Cloud sync isn't configured (e.g. missing build-time secrets) — fall
    // back to local-only mode rather than blocking the whole app.
    return <>{children}</>;
  }

  if (!checkedRedirect || !checkedEmailLink || !authReady) {
    return <div className="app-loading">Loading {appTitle}…</div>;
  }

  if (!user) {
    // Landed here from a sign-in link but opened on a device/browser that
    // doesn't remember which email it was sent to — ask, then finish.
    if (emailLink.step === "needs-email" || emailLink.step === "completing") {
      return (
        <div className="auth-gate">
          <span className="app-title">{appTitle}</span>
          <p>Confirm the email this sign-in link was sent to.</p>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-email-form">
            <input
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={emailLink.step === "completing"}
            />
            <button
              type="button"
              className="primary"
              onClick={() => void handleConfirmEmailForLink()}
              disabled={emailLink.step === "completing" || !emailInput.trim()}
            >
              {emailLink.step === "completing" ? "Signing in…" : "Confirm & sign in"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="auth-gate">
        <span className="app-title">{appTitle}</span>
        <p>{signInPrompt}</p>
        {error && <p className="auth-error">{error}</p>}
        <button
          type="button"
          className="primary"
          onClick={() => {
            setError(null);
            signIn({ forceRedirectInStandalone }).catch((err) => {
              // A user closing the popup isn't worth surfacing as an error.
              if (err instanceof Error && err.message.includes("popup-closed-by-user")) return;
              setError(err instanceof Error ? err.message : "Sign-in failed.");
            });
          }}
        >
          Sign in with Google
        </button>

        {emailLink.step === "form-hidden" && (
          <button type="button" className="ghost" onClick={() => setEmailLink({ step: "form-open" })}>
            Trouble signing in? Use email instead
          </button>
        )}

        {(emailLink.step === "form-open" || emailLink.step === "sending") && (
          <div className="auth-email-form">
            <p className="settings-hint small">
              No popup, no redirect — we'll email you a link that signs you in the moment you open it on this device.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={emailLink.step === "sending"}
            />
            <button
              type="button"
              onClick={() => void handleSendEmailLink()}
              disabled={emailLink.step === "sending" || !emailInput.trim()}
            >
              {emailLink.step === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
          </div>
        )}

        {emailLink.step === "sent" && (
          <p className="settings-status">Check your email for a sign-in link — open it on this device to finish.</p>
        )}
      </div>
    );
  }

  return (
    <>
      {syncing && <div className="sync-banner">Syncing…</div>}
      {error && <div className="sync-banner sync-banner-error">{error}</div>}
      {children}
    </>
  );
}
