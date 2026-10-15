import { Link } from "react-router";
import { useNotesFor } from "../data/selectors";
import GoBackCard from "./GoBackCard";
import NoteCard from "./NoteCard";

interface Props {
  companyId?: string;
  personId?: string;
  alsoEngagementIds?: string[];
}

export function GoBackFor(ctx: Props) {
  const notes = useNotesFor(ctx).filter((n) => n.type === "if-i-go-back");
  return <GoBackCard notes={notes} />;
}

// The notes list at the foot of a company/person page. "If I go back" notes
// are left out here because they're already shown at the top of the page.
export default function NotesSection(ctx: Props) {
  const notes = useNotesFor(ctx).filter((n) => n.type !== "if-i-go-back");
  const query = ctx.companyId ? `company=${ctx.companyId}` : `person=${ctx.personId}`;
  return (
    <section className="section">
      <div className="section-head">
        <h2>Notes</h2>
        <Link className="btn small" to={`/notes/new?${query}`}>
          ＋ Note
        </Link>
      </div>
      {notes.length === 0 ? (
        <p className="empty">No notes yet.</p>
      ) : (
        notes.map((n) => <NoteCard key={n.id} note={n} context={ctx} />)
      )}
    </section>
  );
}
