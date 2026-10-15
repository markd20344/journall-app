import { Link } from "react-router";
import { formatDate } from "../lib/format";
import type { Note } from "../types";

// "If I go back" notes, pinned to the top of a company or person page —
// the first thing to read before picking up the phone.
export default function GoBackCard({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
  return (
    <section className="go-back" aria-label="If I go back">
      <h2>↩️ If I go back</h2>
      {notes.map((n) => (
        <div key={n.id} className="go-back-item">
          {n.body}
          <span className="meta">
            {formatDate(n.occurredAt)} · <Link to={`/notes/${n.id}/edit`}>Edit</Link>
          </span>
        </div>
      ))}
    </section>
  );
}
