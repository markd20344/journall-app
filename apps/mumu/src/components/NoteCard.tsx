import { Link } from "react-router";
import DetectedLinks from "@journall/shared/components/DetectedLinks";
import { updateRecord } from "../data/repo";
import { useStore } from "../data/store";
import { formatDateTime, personName } from "../lib/format";
import { noteTypeMeta } from "../lib/labels";
import type { Note } from "../types";

interface Props {
  note: Note;
  /** The page this card is shown on — its own link chip is left out. */
  context?: { companyId?: string; personId?: string };
}

export default function NoteCard({ note, context }: Props) {
  const { companies, people } = useStore();
  const meta = noteTypeMeta(note.type);
  const companyLinks = note.companyIds.filter((id) => id !== context?.companyId);
  const personLinks = note.personIds.filter((id) => id !== context?.personId);

  return (
    <article className={`note${note.pinned ? " pinned" : ""}${note.type === "if-i-go-back" ? " go-back-note" : ""}`}>
      <div className="note-head">
        <span>
          {meta.icon} {meta.label}
        </span>
        <span>·</span>
        <time className="grow" dateTime={note.occurredAt}>
          {formatDateTime(note.occurredAt)}
        </time>
        {note.pinned && <span title="Pinned">📌</span>}
      </div>
      <div className="note-body">{note.body}</div>
      <DetectedLinks text={note.body} />
      {(companyLinks.length > 0 || personLinks.length > 0 || note.tags.length > 0) && (
        <div className="note-links">
          {companyLinks.map((id) => {
            const c = companies.byId.get(id);
            return c && !c.deleted ? (
              <Link key={id} to={`/companies/${id}`} className="chip">
                🏢 {c.name}
              </Link>
            ) : null;
          })}
          {personLinks.map((id) => {
            const p = people.byId.get(id);
            return p && !p.deleted ? (
              <Link key={id} to={`/people/${id}`} className="chip">
                👤 {personName(p)}
              </Link>
            ) : null;
          })}
          {note.tags.map((t) => (
            <Link key={t} to={`/notes?tag=${encodeURIComponent(t)}`} className="chip">
              #{t}
            </Link>
          ))}
        </div>
      )}
      <div className="note-actions">
        <button type="button" className="ghost small" onClick={() => updateRecord("notes", note.id, { pinned: !note.pinned })}>
          {note.pinned ? "Unpin" : "Pin"}
        </button>
        <Link className="btn ghost small" to={`/notes/${note.id}/edit`} aria-label="Edit note">
          Edit
        </Link>
      </div>
    </article>
  );
}
