import { Link } from "react-router";
import DateRow from "../components/DateRow";
import EngagementRow from "../components/EngagementRow";
import NoteCard from "../components/NoteCard";
import { sortNotes, useUpcomingDates } from "../data/selectors";
import { useCollection, useRecent, useStore } from "../data/store";
import { initials, personName } from "../lib/format";
import type { RecentRef } from "../types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Maidin mhaith"; // good morning
  if (h < 18) return "Dia duit"; // hello
  return "Tráthnóna maith"; // good evening
}

const UPCOMING_DAYS = 30;

export default function HomePage() {
  const s = useStore();
  const notes = useCollection("notes");
  const upcoming = useUpcomingDates(UPCOMING_DAYS);
  const pinned = sortNotes(notes.filter((n) => n.pinned));
  const ongoing = s.engagements.live.filter((e) => e.endDate === null);
  const recent = useRecent();
  const isEmpty = s.people.live.length === 0 && s.companies.live.length === 0 && notes.length === 0;

  return (
    <div className="page">
      <div>
        <p className="greeting">{greeting()}</p>
        <h1>Home</h1>
      </div>

      <div className="quick-actions">
        <Link className="btn" to="/people/new">
          <span>👤</span>Person
        </Link>
        <Link className="btn" to="/companies/new">
          <span>🏢</span>Company
        </Link>
        <Link className="btn" to="/notes/new">
          <span>📝</span>Note
        </Link>
      </div>

      {isEmpty && <p className="empty">Welcome to Mumu. Start by adding a person or a company — notes can be linked to either, or both.</p>}

      <section className="section" aria-labelledby="coming-up">
        <div className="section-head">
          <h2 id="coming-up">🎂 Coming up</h2>
          <Link to="/dates">All dates</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="empty">Nothing in the next {UPCOMING_DAYS} days.</p>
        ) : (
          <div className="list">
            {upcoming.map((u) => (
              <DateRow key={u.item.id} entry={u} />
            ))}
          </div>
        )}
      </section>

      {pinned.length > 0 && (
        <section className="section">
          <h2>📌 Pinned</h2>
          {pinned.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </section>
      )}

      {ongoing.length > 0 && (
        <section className="section">
          <h2>💼 Current work</h2>
          <div className="list">
            {ongoing.map((e) => (
              <EngagementRow key={e.id} engagement={e} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed refs={recent} />
    </div>
  );
}

function RecentlyViewed({ refs }: { refs: RecentRef[] }) {
  const { people, companies, engagements } = useStore();
  const rows = refs
    .map((r) => {
      if (r.kind === "person") {
        const p = people.byId.get(r.id);
        return p && !p.deleted ? { key: `p${r.id}`, to: `/people/${r.id}`, label: personName(p), icon: initials(personName(p)), square: false } : null;
      }
      if (r.kind === "company") {
        const c = companies.byId.get(r.id);
        return c && !c.deleted ? { key: `c${r.id}`, to: `/companies/${r.id}`, label: c.name, icon: initials(c.name), square: true } : null;
      }
      const e = engagements.byId.get(r.id);
      return e && !e.deleted ? { key: `e${r.id}`, to: `/engagements/${r.id}`, label: e.title || e.myRole || "Engagement", icon: "💼", square: true } : null;
    })
    .filter((r) => r !== null)
    .slice(0, 6);

  if (rows.length === 0) return null;
  return (
    <section className="section">
      <h2>🕘 Recently viewed</h2>
      <div className="list">
        {rows.map((r) => (
          <Link key={r.key} to={r.to} className="row">
            <span className={`avatar${r.square ? " square" : ""}`}>{r.icon}</span>
            <span className="row-main">
              <span className="row-title">{r.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
