import { useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { consumeRedirectResult, signIn, watchAuthState } from "../firebase/auth";
import { startSync, stopSync } from "../firebase/sync";
import { startFamilySync, stopFamilySync } from "../firebase/familySync";
import { claimInviteIfAny } from "../family/role";
import { firebaseEnabled } from "../firebase/config";
import { cleanupDictationArtifacts, dedupeCategoriesAndTopics, dedupeItemCodes } from "../db/repo";

export default function AuthGate({ children }: { children: ReactNode }) {
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
      stopSync();
      stopFamilySync();
      return;
    }
    setSyncing(true);
    setError(null);
    startSync(user.uid)
      // Sequential, not parallel: these can touch the same item rows, and
      // running them concurrently risks one clobbering the other's write.
      .then(() => dedupeCategoriesAndTopics())
      .then(() => dedupeItemCodes())
      .then(() => cleanupDictationArtifacts())
      .catch((err) => setError(err instanceof Error ? err.message : "Cloud sync failed to start."))
      .finally(() => setSyncing(false));

    // Best-effort and independent of the journal sync above: a signed-in
    // account with no family tree access yet (never invited) is expected,
    // not an error worth surfacing here.
    void (async () => {
      try {
        await claimInviteIfAny(user);
      } catch (err) {
        console.error("Family tree invite claim failed", err);
      }
      try {
        await startFamilySync(user.uid);
      } catch (err) {
        console.error("Family tree sync failed to start", err);
      }
    })();
  }, [user]);

  if (!firebaseEnabled) {
    // Cloud sync isn't configured (e.g. missing build-time secrets) — fall
    // back to local-only mode rather than blocking the whole app.
    return <>{children}</>;
  }

  if (!checkedRedirect || !authReady) {
    return <div className="app-loading">Loading your journal…</div>;
  }

  if (!user) {
    return (
      <div className="auth-gate">
        <span className="app-title">Journall OS</span>
        <p>Sign in with Google to sync your journal across your PC and phone.</p>
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
