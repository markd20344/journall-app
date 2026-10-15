import { Link } from "react-router";
import FilterChips from "../components/FilterChips";
import NoteCard from "../components/NoteCard";
import { sortNotes, useAllTags } from "../data/selectors";
import { useCollection, useStore } from "../data/store";
import { personName } from "../lib/format";
import { NOTE_TYPES } from "../lib/labels";
import { matches } from "../lib/search";
import { useParamState } from "../lib/useParamState";

export default function NotesPage() {
  const notes = useCollection("notes");
  const { companies, people } = useStore();
  const allTags = useAllTags();
  const [q, setQ] = useParamState("q");
  const [type, setType] = useParamState("type");
  const [tag, setTag] = useParamState("tag");
  const [pinned, setPinned] = useParamState("pinned");

  const linkedNames = (ids: string[], kind: "c" | "p") =>
    ids
      .map((id) => (kind === "c" ? companies.byId.get(id)?.name : people.byId.get(id) && personName(people.byId.get(id)!)))
      .filter(Boolean)
      .join(" ");

  const shown = sortNotes(
    notes
      .filter((n) => (!type || n.type === type) && (!tag || n.tags.includes(tag)) && (!pinned || n.pinned))
      .filter((n) => matches(q, n.body, n.tags.join(" "), linkedNames(n.companyIds, "c"), linkedNames(n.personIds, "p"))),
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>Notes</h1>
        <Link className="btn primary" to="/notes/new">
          ＋ Note
        </Link>
      </div>
      <input className="search" type="search" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
      <FilterChips label="Type" options={NOTE_TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }))} value={type} onChange={setType} allLabel="All notes" />
      <div className="chips">
        <button type="button" className={`chip${pinned ? " on" : ""}`} onClick={() => setPinned(pinned ? "" : "1")}>
          📌 Pinned
        </button>
        {tag && (
          <button type="button" className="chip on" onClick={() => setTag("")}>
            #{tag} ✕
          </button>
        )}
        {!tag &&
          allTags.slice(0, 12).map((t) => (
            <button key={t} type="button" className="chip" onClick={() => setTag(t)}>
              #{t}
            </button>
          ))}
      </div>
      {shown.length === 0 ? (
        <p className="empty">{notes.length === 0 ? "No notes yet." : "Nothing matches."}</p>
      ) : (
        shown.map((n) => <NoteCard key={n.id} note={n} />)
      )}
    </div>
  );
}
