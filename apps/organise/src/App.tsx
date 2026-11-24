import { useState } from "react";
import type { User } from "firebase/auth";
import AuthGate from "@journall/shared/components/AuthGate";
import ErrorBoundary from "@journall/shared/components/ErrorBoundary";
import SyncStatusBadge from "@journall/shared/components/SyncStatusBadge";
import ToastHost from "@journall/shared/components/ToastHost";
import UpdatePrompt from "@journall/shared/components/UpdatePrompt";
import { signOutUser } from "@journall/shared/firebase/auth";
import { firebaseEnabled } from "@journall/shared/firebase/config";
import { startStore, stopStore, subscribeSyncStatus, useItems } from "./data/store";
import { LISTS, LIST_ORDER } from "./lib/lists";
import { listOf, type ListKind } from "./types";
import ListPage from "./components/ListPage";

const LAST_LIST_KEY = "organise:list";

// Starting the listener is synchronous; the cached list shows straight away.
async function onSignedIn(user: User): Promise<void> {
  startStore(user.uid);
}

function isList(value: string | null): value is ListKind {
  return value === "food" || value === "clothes" || value === "todo";
}

// ?list=clothes (home-screen shortcuts) wins, then the list used last on this
// device, so reopening the app lands where you left off.
function initialList(): ListKind {
  const fromUrl = new URLSearchParams(window.location.search).get("list");
  if (isList(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(LAST_LIST_KEY);
    if (isList(saved)) return saved;
  } catch {
    // Storage blocked: start on Food.
  }
  return "food";
}

// Read once at start-up, then dropped from the address bar so a reload
// doesn't start the mic again.
const startParams = new URLSearchParams(window.location.search);
const START_LIST = initialList();
const AUTO_LISTEN = startParams.get("voice") === "1";
if (startParams.has("voice") || startParams.has("list")) window.history.replaceState(null, "", window.location.pathname);

function Lists() {
  const { items, ready } = useItems();
  const [list, setList] = useState<ListKind>(START_LIST);
  // Only the first list opened by the shortcut starts the mic by itself.
  const [listenOnOpen, setListenOnOpen] = useState(AUTO_LISTEN);

  function choose(kind: ListKind) {
    setList(kind);
    setListenOnOpen(false);
    try {
      localStorage.setItem(LAST_LIST_KEY, kind);
    } catch {
      // Only a convenience.
    }
  }

  if (!ready) return <div className="app-loading">Loading your lists…</div>;

  return (
    <>
      <nav className="tabs" aria-label="Lists">
        {LIST_ORDER.map((kind) => {
          const count = items.filter((i) => listOf(i) === kind && i.status === "needed").length;
          return (
            <button key={kind} type="button" className={`tab ${list === kind ? "on" : ""}`} aria-current={list === kind ? "page" : undefined} onClick={() => choose(kind)}>
              {LISTS[kind].label}
              {count > 0 && <span className="tab-count">{count}</span>}
            </button>
          );
        })}
      </nav>
      {/* Keyed so switching lists resets the typed text, shop filter and mic. */}
      <ListPage key={list} config={LISTS[list]} allItems={items} autoListen={listenOnOpen} />
    </>
  );
}

export default function App() {
  return (
    <AuthGate
      appTitle="Organise"
      signInPrompt="Sign in with Google so your lists are the same on your phone and computer."
      onSignedIn={onSignedIn}
      onSignedOut={stopStore}
      // Google's popup has been unusable in other installed apps on iOS.
      forceRedirectInStandalone
    >
      <div className="app-shell">
        <div className="sync-slot">
          <SyncStatusBadge subscribe={subscribeSyncStatus} />
        </div>
        <ErrorBoundary appTitle="Organise">
          <Lists />
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
      <UpdatePrompt appTitle="Organise" />
    </AuthGate>
  );
}
