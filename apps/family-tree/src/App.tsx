import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { db } from "./db/db";
import { migrateFromLegacyDbIfNeeded } from "./db/migrateLegacyDb";
import { startFamilySync, stopFamilySync, subscribeFamilySyncStatus } from "./firebase/familySync";
import { claimInviteIfAny } from "./family/role";
import { applyStoredAccentColor } from "@journall/shared/lib/theme";
import AuthGate from "@journall/shared/components/AuthGate";
import ErrorBoundary from "@journall/shared/components/ErrorBoundary";
import SyncStatusBadge from "@journall/shared/components/SyncStatusBadge";
import ToastHost from "@journall/shared/components/ToastHost";
import UpdatePrompt from "@journall/shared/components/UpdatePrompt";
import FamilyTreePage from "./pages/FamilyTreePage";

async function onSignedIn(user: User): Promise<void> {
  // A signed-in account with no family tree access yet (never invited) is
  // expected, not an error worth surfacing here — each step fails on its
  // own rather than blocking the other.
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
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([migrateFromLegacyDbIfNeeded(), applyStoredAccentColor(db.settings)]).then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="app-loading">Loading Family Tree…</div>;
  }

  return (
    <AuthGate
      appTitle="Family Tree"
      signInPrompt="Sign in with Google to view and edit the family tree."
      onSignedIn={onSignedIn}
      onSignedOut={stopFamilySync}
    >
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">
            Family Tree
            <SyncStatusBadge subscribe={subscribeFamilySyncStatus} />
          </span>
        </header>
        <main className="app-main">
          <ErrorBoundary appTitle="Family Tree">
            <FamilyTreePage />
          </ErrorBoundary>
        </main>
      </div>
      <ToastHost />
      <UpdatePrompt appTitle="Family Tree" />
    </AuthGate>
  );
}
