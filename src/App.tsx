import { useEffect, useState } from "react";
import { ensureSeeded } from "./db/db";
import { applyStoredAccentColor } from "./lib/theme";
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
import SettingsPage from "./pages/SettingsPage";

export type View = "today" | "write" | "calendar" | "log" | "browse" | "books" | "settings";

const NAV_ITEMS: Array<{ id: View; label: string }> = [
  { id: "today", label: "Today" },
  { id: "browse", label: "Entries" },
  { id: "log", label: "Log" },
  { id: "books", label: "Books" },
  { id: "calendar", label: "Calendar" },
  { id: "write", label: "Journal" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");

  useEffect(() => {
    void Promise.all([ensureSeeded(), applyStoredAccentColor()]).then(() => setReady(true));
  }, []);

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
            {view === "settings" && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>
      <ToastHost />
      <UpdatePrompt />
    </AuthGate>
  );
}
