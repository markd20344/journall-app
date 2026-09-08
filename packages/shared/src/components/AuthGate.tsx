import { useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { consumeRedirectResult, signIn, watchAuthState } from "../firebase/auth";
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
}

export default function AuthGate({ children, appTitle, signInPrompt, onSignedIn, onSignedOut }: AuthGateProps) {
  const [checkedRedirect, setCheckedRedirect] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consumeRedirectResult()
      .catch((err) => setError(err instanceof Error ? err.message : "Sign-in failed."))
      .finally(() => setCheckedRedirect(true));
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

  if (!firebaseEnabled) {
    // Cloud sync isn't configured (e.g. missing build-time secrets) — fall
    // back to local-only mode rather than blocking the whole app.
    return <>{children}</>;
  }

  if (!checkedRedirect || !authReady) {
    return <div className="app-loading">Loading {appTitle}…</div>;
  }

  if (!user) {
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
            signIn().catch((err) => {
              // A user closing the popup isn't worth surfacing as an error.
              if (err instanceof Error && err.message.includes("popup-closed-by-user")) return;
              setError(err instanceof Error ? err.message : "Sign-in failed.");
            });
          }}
        >
          Sign in with Google
        </button>
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
