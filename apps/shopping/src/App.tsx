import type { User } from "firebase/auth";
import AuthGate from "@journall/shared/components/AuthGate";
import ErrorBoundary from "@journall/shared/components/ErrorBoundary";
import SyncStatusBadge from "@journall/shared/components/SyncStatusBadge";
import ToastHost from "@journall/shared/components/ToastHost";
import UpdatePrompt from "@journall/shared/components/UpdatePrompt";
import { signOutUser } from "@journall/shared/firebase/auth";
import { firebaseEnabled } from "@journall/shared/firebase/config";
import { startStore, stopStore, subscribeSyncStatus } from "./data/store";
import ListPage from "./components/ListPage";

// Starting the listener is synchronous; the cached list shows straight away.
async function onSignedIn(user: User): Promise<void> {
  startStore(user.uid);
}

export default function App() {
  return (
    <AuthGate
      appTitle="Shopping List"
      signInPrompt="Sign in with Google so the list is the same on your phone and computer."
      onSignedIn={onSignedIn}
      onSignedOut={stopStore}
      // Google's popup has been unusable in other installed apps on iOS.
      forceRedirectInStandalone
    >
      <div className="app-shell">
        <div className="sync-slot">
          <SyncStatusBadge subscribe={subscribeSyncStatus} />
        </div>
        <ErrorBoundary appTitle="Shopping List">
          <ListPage />
        </ErrorBoundary>
        {firebaseEnabled && (
          <footer className="foot">
            <button type="button" className="ghost small" onClick={() => void signOutUser()}>
              Sign out
            </button>
          </footer>
        )}
      </div>
      <ToastHost />
      <UpdatePrompt appTitle="Shopping List" />
    </AuthGate>
  );
}
