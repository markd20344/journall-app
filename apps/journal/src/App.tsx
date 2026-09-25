import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { db, ensureSeeded } from "./db/db";
import { cleanupDictationArtifacts, dedupeCategoriesAndTopics, dedupeItemCodes, ensureDomainCategories } from "./db/repo";
import { startSync, stopSync, subscribeSyncStatus } from "./firebase/sync";
import { applyStoredAccentColor } from "@journall/shared/lib/theme";
import { getStoredView, setStoredView } from "./lib/lastView";
import { NAV_ITEMS } from "./lib/navItems";
import AuthGate from "@journall/shared/components/AuthGate";
import ErrorBoundary from "@journall/shared/components/ErrorBoundary";
import SyncStatusBadge from "@journall/shared/components/SyncStatusBadge";
import ToastHost from "@journall/shared/components/ToastHost";
import UpdatePrompt from "@journall/shared/components/UpdatePrompt";
import TodayPage from "./pages/TodayPage";
import WritePage from "./pages/WritePage";
import CalendarPage from "./pages/CalendarPage";
import LogPage from "./pages/LogPage";
import BrowsePage from "./pages/BrowsePage";
import BooksPage from "./pages/BooksPage";
import ProceduresPage from "./pages/ProceduresPage";
import MarketsPage from "./pages/MarketsPage";
import SettingsPage from "./pages/SettingsPage";

export type View = "today" | "write" | "calendar" | "log" | "browse" | "books" | "procedures" | "markets" | "settings";

async function onSignedIn(user: User): Promise<void> {
  // Sequential, not parallel: these can touch the same item rows, and
  // running them concurrently risks one clobbering the other's write.
  await startSync(user.uid);
  await dedupeCategoriesAndTopics();
  await dedupeItemCodes();
  await cleanupDictationArtifacts();
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setViewState] = useState<View>("today");

  useEffect(() => {
    void Promise.all([ensureSeeded().then(ensureDomainCategories), applyStoredAccentColor(db.settings), getStoredView()]).then(
      ([, , lastView]) => {
        setViewState(lastView);
        setReady(true);
      },
    );
  }, []);

  // Reopening on the tab you last had open — not just wherever "today" was
  // showing — needs to be a device-local preference, so this persists on
  // every switch, not just at some scheduled "save" point.
  function setView(next: View): void {
    setViewState(next);
    void setStoredView(next);
  }

  if (!ready) {
    return <div className="app-loading">Loading your journal…</div>;
  }

  return (
    <AuthGate
      appTitle="Journall OS"
      signInPrompt="Sign in with Google to sync your journal across your PC and phone."
      onSignedIn={onSignedIn}
      onSignedOut={stopSync}
    >
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">
            Journall OS
            <SyncStatusBadge subscribe={subscribeSyncStatus} />
          </span>
          <nav className="app-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-btn ${view === item.id ? "active" : ""}`}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>
        <main className="app-main">
          <ErrorBoundary key={view} appTitle="Journall OS">
            {view === "today" && <TodayPage onNavigate={setView} />}
            {view === "write" && <WritePage />}
            {view === "calendar" && <CalendarPage />}
            {view === "log" && <LogPage />}
            {view === "browse" && <BrowsePage />}
            {view === "books" && <BooksPage />}
            {view === "procedures" && <ProceduresPage />}
            {view === "markets" && <MarketsPage />}
            {view === "settings" && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>
      <ToastHost />
      <UpdatePrompt appTitle="Journall OS" />
    </AuthGate>
  );
}
