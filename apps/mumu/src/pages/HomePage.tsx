import { Link } from "react-router";
import NoteCard from "../components/NoteCard";
import { sortNotes } from "../data/selectors";
import { useCollection } from "../data/store";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Maidin mhaith"; // good morning
  if (h < 18) return "Dia duit"; // hello
  return "Tráthnóna maith"; // good evening
}

// Phase 1 Home: quick actions, pinned notes and the latest notes. Upcoming
// dates and recently viewed arrive with the Phase 2 dashboard.
export default function HomePage() {
  const notes = useCollection("notes");
  const pinned = sortNotes(notes.filter((n) => n.pinned));
  const recent = sortNotes(notes.filter((n) => !n.pinned).map((n) => ({ ...n, pinned: false }))).slice(0, 5);
  const people = useCollection("people");
  const companies = useCollection("companies");

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

      {people.length === 0 && companies.length === 0 && notes.length === 0 && (
        <p className="empty">
          Welcome to Mumu. Start by adding a person or a company — notes can be linked to either, or both.
        </p>
      )}

      {pinned.length > 0 && (
        <section className="section">
          <h2>📌 Pinned</h2>
          {pinned.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Latest notes</h2>
            <Link to="/notes">All notes</Link>
          </div>
          {recent.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </section>
      )}
    </div>
  );
}
