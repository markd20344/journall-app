import { format } from "date-fns";
import type { EntryWithRefs } from "../types";

interface Props {
  entry: EntryWithRefs;
  onClick?: () => void;
}

export default function EntryCard({ entry, onClick }: Props) {
  const preview = entry.body.length > 220 ? `${entry.body.slice(0, 220)}…` : entry.body;
  const time = format(new Date(entry.createdAt), "h:mm a");
  return (
    <button type="button" className="entry-card" onClick={onClick}>
      <div className="entry-card-meta">
        <span className="entry-card-date">
          {entry.date} · {time}
        </span>
        {entry.category && (
          <span className="category-pill" style={{ background: entry.category.color }}>
            {entry.category.name}
          </span>
        )}
        {entry.topics.map((t) => (
          <span className="topic-pill" key={t.id}>
            {t.name}
          </span>
        ))}
      </div>
      <p className="entry-card-body">{preview}</p>
    </button>
  );
}
