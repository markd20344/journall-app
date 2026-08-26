import { useEffect, useState } from "react";
import { ensureSeeded } from "./db/db";
import { ensureDomainCategories } from "./db/repo";
import { applyStoredAccentColor } from "./lib/theme";
import { getStoredView, setStoredView } from "./lib/lastView";
import { NAV_ITEMS } from "./lib/navItems";
import AuthGate from "./components/AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";
import SyncStatusBadge from "./components/SyncStatusBadge";
import ToastHost from "./components/ToastHost";
import UpdatePrompt from "./components/UpdatePrompt";
import TodayPage from "./pages/TodayPage";
import WritePage from "./pages/WritePage";
import CalendarPage from "./pages/CalendarPage";
import LogPage from "./pages/LogPage";
import BrowsePage from "./pages/BrowsePage";
import BooksPage from "./pages/BooksPage";
import KitRunsPage from "./pages/KitRunsPage";
import MarketsPage from "./pages/MarketsPage";
import FamilyTreePage from "./pages/FamilyTreePage";
import SettingsPage from "./pages/SettingsPage";

export type View = "today" | "write" | "calendar" | "log" | "browse" | "books" | "kit" | "markets" | "family" | "settings";

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setViewState] = useState<View>("today");

  useEffect(() => {
    void Promise.all([ensureSeeded().then(ensureDomainCategories), applyStoredAccentColor(), getStoredView()]).then(
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
    <AuthGate>
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">
            Journall OS
            <SyncStatusBadge />
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
          <ErrorBoundary key={view}>
            {view === "today" && <TodayPage onNavigate={setView} />}
            {view === "write" && <WritePage />}
            {view === "calendar" && <CalendarPage />}
            {view === "log" && <LogPage />}
            {view === "browse" && <BrowsePage />}
            {view === "books" && <BooksPage />}
            {view === "kit" && <KitRunsPage />}
            {view === "markets" && <MarketsPage />}
            {view === "family" && <FamilyTreePage />}
            {view === "settings" && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>
      <ToastHost />
      <UpdatePrompt />
    </AuthGate>
  );
}
