import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { db } from "./db/db";
import { migrateFromLegacyDbIfNeeded } from "./db/migrateLegacyDb";
import { startSync, stopSync, subscribeSyncStatus } from "./firebase/sync";
import { applyStoredAccentColor } from "@journall/shared/lib/theme";
import AuthGate from "@journall/shared/components/AuthGate";
import ErrorBoundary from "@journall/shared/components/ErrorBoundary";
import SyncStatusBadge from "@journall/shared/components/SyncStatusBadge";
import ToastHost from "@journall/shared/components/ToastHost";
import UpdatePrompt from "@journall/shared/components/UpdatePrompt";
import KitRunsPage from "./pages/KitRunsPage";

async function onSignedIn(user: User): Promise<void> {
  await startSync(user.uid);
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([migrateFromLegacyDbIfNeeded(), applyStoredAccentColor(db.settings)]).then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="app-loading">Loading Kit Runs…</div>;
  }

  return (
    <AuthGate
      appTitle="Kit Runs"
      signInPrompt="Sign in with Google to sync your kit runs across your PC and phone."
      onSignedIn={onSignedIn}
      onSignedOut={stopSync}
    >
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">
            Kit Runs
            <SyncStatusBadge subscribe={subscribeSyncStatus} />
          </span>
        </header>
        <main className="app-main">
          <ErrorBoundary appTitle="Kit Runs">
            <KitRunsPage />
          </ErrorBoundary>
        </main>
      </div>
      <ToastHost />
      <UpdatePrompt appTitle="Kit Runs" />
    </AuthGate>
  );
}
