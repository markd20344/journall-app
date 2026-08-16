import { useEffect, useState } from "react";
import { ensureSeeded } from "./db/db";
import WritePage from "./pages/WritePage";
import CalendarPage from "./pages/CalendarPage";
import BrowsePage from "./pages/BrowsePage";
import SettingsPage from "./pages/SettingsPage";

type View = "write" | "calendar" | "browse" | "settings";

const NAV_ITEMS: Array<{ id: View; label: string }> = [
  { id: "write", label: "Write" },
  { id: "calendar", label: "Calendar" },
  { id: "browse", label: "Browse" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("write");

  useEffect(() => {
    void ensureSeeded().then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="app-loading">Loading your journal…</div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">Journall</span>
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
        {view === "browse" && <BrowsePage />}
        {view === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
