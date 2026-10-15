import { NavLink, Outlet, useLocation } from "react-router";
import ErrorBoundary from "@journall/shared/components/ErrorBoundary";
import Icon from "./Icon";
import SyncBadge from "./SyncBadge";

const NAV = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/people", label: "People", icon: "people" },
  { to: "/companies", label: "Companies", icon: "companies" },
  { to: "/notes", label: "Notes", icon: "notes" },
  { to: "/more", label: "More", icon: "more" },
];

function Brand() {
  return (
    <NavLink to="/" className="brand">
      <img src="/icons/icon-192.png" alt="" />
      Mumu
    </NavLink>
  );
}

export default function Layout() {
  const location = useLocation();
  // Reset a crashed screen when navigating away from it.
  const section = location.pathname.split("/")[1] ?? "";
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Brand />
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `side-link${isActive ? " active" : ""}`}>
            <Icon name={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <header className="topbar">
        <Brand />
        <SyncBadge />
      </header>
      <main className="main">
        <ErrorBoundary key={section} appTitle="Mumu">
          <Outlet />
        </ErrorBoundary>
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
            <Icon name={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
