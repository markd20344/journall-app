import { useEffect, useState } from "react";
import { ensureSeeded } from "./db/db";
import { applyStoredAccentColor } from "./lib/theme";
import AuthGate from "./components/AuthGate";
import ToastHost from "./components/ToastHost";
import WritePage from "./pages/WritePage";
import CalendarPage from "./pages/CalendarPage";
import LogPage from "./pages/LogPage";
import BrowsePage from "./pages/BrowsePage";
import SettingsPage from "./pages/SettingsPage";

type View = "write" | "calendar" | "log" | "browse" | "settings";

const NAV_ITEMS: Array<{ id: View; label: string }> = [
  { id: "browse", label: "Entries" },
  { id: "log", label: "Log" },
  { id: "calendar", label: "Calendar" },
  { id: "write", label: "Journal" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("browse");

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
          <span className="app-title">Journall OS</span>
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
          {view === "write" && <WritePage />}
          {view === "calendar" && <CalendarPage />}
          {view === "log" && <LogPage />}
          {view === "browse" && <BrowsePage />}
          {view === "settings" && <SettingsPage />}
        </main>
      </div>
      <ToastHost />
    </AuthGate>
  );
}
